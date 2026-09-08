"""Stage: tagger — text -> skill-id multi-label classifier on top of the
fine-tuned embeddings.

This is the offline replacement for the LLM-first "map this resume / README
/ repo description to catalogue skill ids" calls in
``src/lib/evidence/resume.ts`` and ``src/lib/evidence/github.ts``.
One logistic head per skill (211 x 384 weights + bias) — small enough to
ship as JSON and evaluate in TypeScript with a single matmul once the
query embedding is available.

The baseline it must beat is plain cosine tagging from the retriever stage,
so both are reported side by side.
"""
from __future__ import annotations

import pickle
from pathlib import Path

import numpy as np

from .common import load_json, load_mapping, save_json


def _f1_stats(pred: np.ndarray, gold: np.ndarray) -> dict:
    tp = int((pred & gold).sum())
    fp = int((pred & ~gold).sum())
    fn = int((~pred & gold).sum())
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    micro = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    # macro over skills with at least one gold positive
    per = []
    for j in range(gold.shape[1]):
        g = gold[:, j]
        if not g.any():
            continue
        p = pred[:, j]
        tpj = int((p & g).sum())
        fpj = int((p & ~g).sum())
        fnj = int((~p & g).sum())
        pj = tpj / (tpj + fpj) if tpj + fpj else 0.0
        rj = tpj / (tpj + fnj) if tpj + fnj else 0.0
        per.append(2 * pj * rj / (pj + rj) if pj + rj else 0.0)
    return {
        "micro_f1": round(micro, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "macro_f1": round(float(np.mean(per)), 4) if per else 0.0,
    }


def run(cfg: dict, out_dir: Path, log, smoke: bool = False) -> dict:
    from sklearn.linear_model import LogisticRegression

    tcfg = cfg["tagger"]
    prep = out_dir / "prepared"
    emb = out_dir / "embeddings"
    ids = load_json(emb / "ids.json")
    S = np.load(emb / "skills.npy")
    C = np.load(emb / "courses.npy")
    split = load_json(prep / "split.json")
    mapping = load_mapping()

    skill_ids: list[str] = ids["skills"]
    course_ids: list[str] = ids["courses"]
    sidx = {s: i for i, s in enumerate(skill_ids)}
    cidx = {c: i for i, c in enumerate(course_ids)}

    def multi_hot(cids: list[str]) -> np.ndarray:
        Y = np.zeros((len(cids), len(skill_ids)), dtype=bool)
        for r, cid in enumerate(cids):
            for s in mapping.get(cid, []):
                if s in sidx:
                    Y[r, sidx[s]] = True
        return Y

    train_ids = [c for c in split["train"] if c in cidx]
    hold_ids = [c for c in split["holdout"] if c in cidx]
    if smoke:
        train_ids = train_ids[:600]
    Xtr, Ytr = C[[cidx[c] for c in train_ids]], multi_hot(train_ids)
    Xho, Yho = C[[cidx[c] for c in hold_ids]], multi_hot(hold_ids)

    # Extra collected texts join training; their holdout is evaluated per source.
    extra = load_json(prep / "extra.json") if (prep / "extra.json").exists() else []
    E = np.load(emb / "extra.npy") if (emb / "extra.npy").exists() and extra else np.zeros((0, C.shape[1]), dtype=np.float32)
    extra_hold: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    if extra:
        def hot(rows: list[dict]) -> np.ndarray:
            Y = np.zeros((len(rows), len(skill_ids)), dtype=bool)
            for r_i, r in enumerate(rows):
                for s in r["skill_ids"]:
                    if s in sidx:
                        Y[r_i, sidx[s]] = True
            return Y

        tr_idx = [i for i, r in enumerate(extra) if r["split"] == "train"]
        if smoke:
            tr_idx = tr_idx[:1500]
        if tr_idx:
            Xtr = np.vstack([Xtr, E[tr_idx]])
            Ytr = np.vstack([Ytr, hot([extra[i] for i in tr_idx])])
        for source in sorted({r["source"] for r in extra}):
            ho = [i for i, r in enumerate(extra) if r["source"] == source and r["split"] == "holdout"]
            if len(ho) >= 10:
                extra_hold[source] = (E[ho], hot([extra[i] for i in ho]))
        log.info("tagger: +%d extra training texts, holdout sources %s", len(tr_idx), {k: len(v[0]) for k, v in extra_hold.items()})

    dim = C.shape[1]
    W = np.zeros((len(skill_ids), dim), dtype=np.float32)
    b = np.full(len(skill_ids), -30.0, dtype=np.float32)  # untrained heads never fire
    trained: list[str] = []
    for j, sid in enumerate(skill_ids):
        y = Ytr[:, j]
        if y.sum() < int(tcfg["min_positives"]) or y.sum() == len(y):
            continue
        clf = LogisticRegression(C=float(tcfg["C"]), class_weight="balanced", max_iter=2000)
        clf.fit(Xtr, y)
        W[j] = clf.coef_[0]
        b[j] = clf.intercept_[0]
        trained.append(sid)
    log.info("tagger: trained %d/%d skill heads on %d courses", len(trained), len(skill_ids), len(train_ids))

    # threshold sweep on holdout
    logits = Xho @ W.T + b
    probs = 1 / (1 + np.exp(-logits))
    best = {"threshold": 0.5, "micro_f1": -1.0}
    for t in np.arange(0.2, 0.96, 0.02):
        st = _f1_stats(probs >= t, Yho)
        if st["micro_f1"] > best["micro_f1"]:
            best = {"threshold": round(float(t), 2), **st}

    # cosine baseline with the retriever's own best threshold
    sims = Xho @ S.T
    cos_best = {"threshold": 0.6, "micro_f1": -1.0}
    for t in np.arange(0.3, 0.95, 0.01):
        st = _f1_stats(sims >= t, Yho)
        if st["micro_f1"] > cos_best["micro_f1"]:
            cos_best = {"threshold": round(float(t), 2), **st}

    # hybrid: logistic OR cosine (covers untrained heads)
    hybrid = _f1_stats((probs >= best["threshold"]) | (sims >= cos_best["threshold"]), Yho)

    # per-source metrics on the extra holdout at the thresholds chosen above
    extra_metrics: dict[str, dict] = {}
    for source, (Xe, Ye) in extra_hold.items():
        pe = 1 / (1 + np.exp(-(Xe @ W.T + b)))
        se = Xe @ S.T
        extra_metrics[source] = {
            "n": int(len(Xe)),
            "logistic": _f1_stats(pe >= best["threshold"], Ye),
            "cosine": _f1_stats(se >= cos_best["threshold"], Ye),
            "hybrid_or": _f1_stats((pe >= best["threshold"]) | (se >= cos_best["threshold"]), Ye),
        }
    if extra_metrics:
        log.info("tagger: extra holdout %s", {k: v["logistic"]["micro_f1"] for k, v in extra_metrics.items()})

    model_dir = out_dir / "models" / "tagger"
    model_dir.mkdir(parents=True, exist_ok=True)
    save_json(
        model_dir / "weights.json",
        {
            "embedding_model": ids["model"],
            "dim": dim,
            "skill_ids": skill_ids,
            "W": np.round(W, 5).tolist(),
            "b": np.round(b, 5).tolist(),
            "threshold": best["threshold"],
            "cosine_threshold": cos_best["threshold"],
            "trained_skill_ids": trained,
            "untrained_skill_ids": [s for s in skill_ids if s not in set(trained)],
        },
        indent=None,
    )
    with open(model_dir / "tagger.pkl", "wb") as f:
        pickle.dump({"W": W, "b": b, "skill_ids": skill_ids, "threshold": best["threshold"]}, f)

    result = {
        "trained_heads": len(trained),
        "train_courses": len(train_ids),
        "train_rows_total": int(len(Xtr)),
        "holdout_courses": len(hold_ids),
        "logistic": best,
        "cosine_baseline": cos_best,
        "hybrid_or": hybrid,
        "extra_holdout": extra_metrics,
    }
    log.info("tagger: logistic %s | cosine %s | hybrid %s", best, cos_best, hybrid)
    return result
