"""Stage: retriever — fine-tune a bi-encoder so skills and courses share one
embedding space.

Why this is the first model worth training: the app's course matching is a
static, pre-computed mapping that leaves 45 of 211 skills (the three AI
domains) with zero courses, and ``skillSearch`` is substring matching.
One embedding space fixes both and gives every later stage (tagger,
neighbours, edge suggestions) its features.

Training signal: (course_text -> skill_text) positives from the existing
mapping, one same-domain hard negative per pair, MultipleNegativesRanking
loss with in-batch negatives. Evaluated on held-out courses against the
untouched base model so the report shows the lift, not just a number.
"""
from __future__ import annotations

import shutil
from pathlib import Path

import numpy as np

from .common import Timer, device_name, load_json, load_mapping, read_jsonl, save_json


def _encode(model, texts: list[str], batch_size: int = 128) -> np.ndarray:
    return np.asarray(
        model.encode(texts, batch_size=batch_size, normalize_embeddings=True, show_progress_bar=False, convert_to_numpy=True),
        dtype=np.float32,
    )


def evaluate_retrieval(
    S: np.ndarray,
    skill_ids: list[str],
    C: np.ndarray,
    course_ids: list[str],
    mapping: dict[str, list[str]],
    ks=(1, 3, 5, 10),
) -> dict:
    """Course->skill recall@k / MRR and skill->course precision@5 / recall@10,
    plus the cosine threshold that maximises course->skill F1 (used later to
    extend the mapping)."""
    skill_index = {sid: i for i, sid in enumerate(skill_ids)}
    sims = C @ S.T  # courses x skills (both normalised)

    recall = {k: [] for k in ks}
    mrr = []
    labels_per_course: list[set[int]] = []
    for i, cid in enumerate(course_ids):
        labels = {skill_index[s] for s in mapping.get(cid, []) if s in skill_index}
        labels_per_course.append(labels)
        if not labels:
            continue
        ranked = np.argsort(-sims[i])
        for k in ks:
            top = set(ranked[:k].tolist())
            recall[k].append(len(top & labels) / len(labels))
        first = next((r for r, j in enumerate(ranked.tolist()) if j in labels), None)
        mrr.append(1.0 / (first + 1) if first is not None else 0.0)

    # skill -> course
    p5, r10 = [], []
    for j, sid in enumerate(skill_ids):
        pos = {i for i, labels in enumerate(labels_per_course) if j in labels}
        if not pos:
            continue
        ranked = np.argsort(-sims[:, j]).tolist()
        p5.append(len(set(ranked[:5]) & pos) / 5)
        r10.append(len(set(ranked[:10]) & pos) / len(pos))

    # threshold search for course->skill tagging by cosine
    best = {"threshold": 0.6, "f1": 0.0, "precision": 0.0, "recall": 0.0}
    for t in np.arange(0.30, 0.95, 0.01):
        tp = fp = fn = 0
        for i, labels in enumerate(labels_per_course):
            if not labels:
                continue
            pred = set(np.where(sims[i] >= t)[0].tolist())
            tp += len(pred & labels)
            fp += len(pred - labels)
            fn += len(labels - pred)
        prec = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
        if f1 > best["f1"]:
            best = {"threshold": round(float(t), 2), "f1": round(f1, 4), "precision": round(prec, 4), "recall": round(rec, 4)}

    return {
        "n_holdout_courses": len(mrr),
        "course_to_skill": {
            **{f"recall@{k}": round(float(np.mean(v)), 4) for k, v in recall.items() if v},
            "mrr": round(float(np.mean(mrr)), 4) if mrr else 0.0,
        },
        "skill_to_course": {
            "precision@5": round(float(np.mean(p5)), 4) if p5 else 0.0,
            "recall@10": round(float(np.mean(r10)), 4) if r10 else 0.0,
            "skills_evaluated": len(p5),
        },
        "cosine_tagging": best,
    }


def run(cfg: dict, out_dir: Path, log, smoke: bool = False) -> dict:
    import torch
    from datasets import Dataset
    from sentence_transformers import (
        SentenceTransformer,
        SentenceTransformerTrainer,
        SentenceTransformerTrainingArguments,
        losses,
    )
    from sentence_transformers.training_args import BatchSamplers

    rcfg = cfg["retriever"]
    prep = out_dir / "prepared"
    skills = load_json(prep / "skills.json")
    courses = load_json(prep / "courses.json")
    resources = load_json(prep / "resources.json")
    split = load_json(prep / "split.json")
    mapping = load_mapping()
    pairs = [p for p in read_jsonl(prep / "pairs_train.jsonl") if p.get("negative")]

    epochs = int(rcfg["epochs"])
    batch_size = int(rcfg["batch_size"])
    if smoke:
        pairs = pairs[:300]
        epochs = 1
        batch_size = min(batch_size, 16)
        log.info("retriever: SMOKE mode - %d pairs, 1 epoch", len(pairs))

    dev = device_name()
    log.info("retriever: base=%s device=%s pairs=%d epochs=%d bs=%d", rcfg["base_model"], dev, len(pairs), epochs, batch_size)

    skill_ids = [s["id"] for s in skills]
    skill_texts = [s["text"] for s in skills]
    hold_set = set(split["holdout"])
    hold_courses = [c for c in courses if c["id"] in hold_set]
    hold_ids = [c["id"] for c in hold_courses]
    hold_texts = [c["text"] for c in hold_courses]

    # ── Baseline (untrained) ─────────────────────────────────────────────
    t = Timer()
    model = SentenceTransformer(rcfg["base_model"], device=dev)
    model.max_seq_length = int(rcfg["max_seq_length"])
    baseline = evaluate_retrieval(_encode(model, skill_texts), skill_ids, _encode(model, hold_texts), hold_ids, mapping)
    log.info("retriever: baseline course->skill %s (%.0fs)", baseline["course_to_skill"], t.elapsed())

    # ── Fine-tune ────────────────────────────────────────────────────────
    ds = Dataset.from_list([{"anchor": p["anchor"], "positive": p["positive"], "negative": p["negative"]} for p in pairs])
    use_bf16 = dev == "cuda" and torch.cuda.is_bf16_supported()
    # transformers v5 replaced warmup_ratio with a fractional warmup_steps.
    import transformers

    warmup = {"warmup_steps": 0.1} if int(transformers.__version__.split(".")[0]) >= 5 else {"warmup_ratio": 0.1}
    args = SentenceTransformerTrainingArguments(
        output_dir=str(out_dir / "tmp_retriever"),
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        learning_rate=float(rcfg["learning_rate"]),
        **warmup,
        bf16=use_bf16,
        fp16=(dev == "cuda" and not use_bf16),
        batch_sampler=BatchSamplers.NO_DUPLICATES,
        logging_steps=20,
        save_strategy="no",
        report_to="none",
        dataloader_drop_last=False,
        seed=int(cfg["seed"]),
    )
    trainer = SentenceTransformerTrainer(
        model=model,
        args=args,
        train_dataset=ds,
        loss=losses.MultipleNegativesRankingLoss(model),
    )
    t = Timer()
    train_out = trainer.train()
    train_seconds = t.elapsed()
    log.info("retriever: trained in %.0fs, final loss %.4f", train_seconds, float(train_out.training_loss))

    model_dir = out_dir / "models" / "retriever"
    model.save(str(model_dir))
    shutil.rmtree(out_dir / "tmp_retriever", ignore_errors=True)

    # ── Evaluate + embed everything ──────────────────────────────────────
    S = _encode(model, skill_texts)
    finetuned = evaluate_retrieval(S, skill_ids, _encode(model, hold_texts), hold_ids, mapping)
    log.info("retriever: fine-tuned course->skill %s", finetuned["course_to_skill"])

    C = _encode(model, [c["text"] for c in courses])
    R = _encode(model, [r["text"] for r in resources]) if resources else np.zeros((0, S.shape[1]), dtype=np.float32)

    # Extra collected texts (synthetic / HF course chunks / job posts): embed
    # for the tagger and evaluate retrieval per source on their holdout split,
    # so the report shows how the model reads resume/README-style text.
    extra = load_json(prep / "extra.json") if (prep / "extra.json").exists() else []
    E = _encode(model, [r["text"] for r in extra]) if extra else np.zeros((0, S.shape[1]), dtype=np.float32)
    extra_eval: dict[str, dict] = {}
    for source in sorted({r["source"] for r in extra}):
        rows = [(i, r) for i, r in enumerate(extra) if r["source"] == source and r["split"] == "holdout" and r["skill_ids"]]
        if len(rows) < 10:
            continue
        idx = [i for i, _ in rows]
        m = {r["id"]: r["skill_ids"] for _, r in rows}
        extra_eval[source] = {"n": len(rows), **evaluate_retrieval(S, skill_ids, E[idx], [r["id"] for _, r in rows], m)["course_to_skill"]}
    if extra_eval:
        log.info("retriever: extra-text holdout %s", extra_eval)

    emb = out_dir / "embeddings"
    emb.mkdir(parents=True, exist_ok=True)
    np.save(emb / "skills.npy", S)
    np.save(emb / "courses.npy", C)
    np.save(emb / "resources.npy", R)
    np.save(emb / "extra.npy", E)
    save_json(
        emb / "ids.json",
        {
            "model": rcfg["base_model"],
            "dim": int(S.shape[1]),
            "skills": skill_ids,
            "courses": [c["id"] for c in courses],
            "resources": [r["id"] for r in resources],
            "extra": [r["id"] for r in extra],
        },
    )

    # ── Optional ONNX export (for transformers.js in the Next.js app) ────
    onnx_status = "skipped"
    if rcfg.get("export_onnx", True) and not smoke:
        try:
            onnx_model = SentenceTransformer(str(model_dir), backend="onnx", device="cpu")
            onnx_model.save_pretrained(str(out_dir / "models" / "retriever-onnx"))
            onnx_status = "ok"
            log.info("retriever: ONNX export ok")
        except Exception as e:  # noqa: BLE001 — optional artefact, never fatal
            onnx_status = f"failed: {type(e).__name__}: {str(e)[:200]}"
            log.warning("retriever: ONNX export failed (%s) - embeddings are still complete", e)

    metrics = {
        "base_model": rcfg["base_model"],
        "device": dev,
        "train_pairs": len(pairs),
        "epochs": epochs,
        "batch_size": batch_size,
        "train_seconds": train_seconds,
        "final_loss": round(float(train_out.training_loss), 4),
        "baseline": baseline,
        "finetuned": finetuned,
        "extra_text_holdout": extra_eval,
        "onnx_export": onnx_status,
    }
    # Persist so a later `--stages derive` on the same output directory uses
    # this run's tuned threshold instead of silently falling back to the
    # default and producing different artefacts than the full run did.
    save_json(out_dir / "retriever_metrics.json", metrics)
    return metrics
