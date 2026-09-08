"""Stage: prepare — turn the static catalogue into training/holdout sets.

Supervision comes from ``course_skill_mapping.json`` (2,118 courses x 1.6
skills on average). Split is by course, deterministic on the seed, so the
retriever and tagger are evaluated on courses they never saw.
"""
from __future__ import annotations

import random
from pathlib import Path

from .common import (
    DATA_DIR,
    course_text,
    load_courses,
    load_graph,
    load_mapping,
    load_resources,
    read_jsonl,
    resource_text,
    save_json,
    skill_text,
    write_jsonl,
)


def load_extra(skills: dict) -> list[dict]:
    """Every ``data/extra/*.jsonl`` row that carries ``skill_ids`` (synthetic
    files are labelled at generation time; collected files get a
    ``.labelled.jsonl`` sibling from ``collect/label_with_llm.py``)."""
    extra_dir = DATA_DIR / "extra"
    if not extra_dir.exists():
        return []
    rows: list[dict] = []
    seen: set[str] = set()
    for path in sorted(extra_dir.glob("*.jsonl")):
        base = path.name.split(".")[0]
        is_labelled = ".labelled" in path.name
        has_labelled_sibling = any(p.name != path.name for p in extra_dir.glob(f"{base}.labelled*.jsonl"))
        if is_labelled or not has_labelled_sibling:
            for r in read_jsonl(path):
                if "skill_ids" not in r or r["id"] in seen:
                    continue
                seen.add(r["id"])
                sids = [s for s in r["skill_ids"] if s in skills]
                text = " ".join(str(r.get("text", "")).split())
                if len(text) < 20:
                    continue
                rows.append({"id": r["id"], "text": text, "skill_ids": sids, "source": r.get("source", path.stem)})
    return rows


def run(cfg: dict, out_dir: Path, log) -> dict:
    rng = random.Random(cfg["seed"])
    graph = load_graph()
    courses = load_courses()
    mapping = load_mapping()
    resources = load_resources()
    skills = graph["skills"]

    prep = out_dir / "prepared"
    prep.mkdir(parents=True, exist_ok=True)

    course_ids = sorted(c["course_id"] for c in courses if c["course_id"] in mapping)
    rng.shuffle(course_ids)
    n_hold = max(1, int(len(course_ids) * cfg["holdout_fraction"]))
    holdout = set(course_ids[:n_hold])
    train = [cid for cid in course_ids if cid not in holdout]

    by_id = {c["course_id"]: c for c in courses}

    def hard_negative(sid: str, positives: set[str]) -> str | None:
        domain = skills[sid]["domain"]
        pool = [x for x in graph["by_domain"][domain] if x not in positives]
        if not pool:
            pool = [x for x in skills if x not in positives]
        return rng.choice(pool) if pool else None

    pairs = []
    for cid in train:
        sids = [s for s in mapping[cid] if s in skills]
        for sid in sids:
            neg = hard_negative(sid, set(sids))
            row = {
                "course_id": cid,
                "skill_id": sid,
                "anchor": course_text(by_id[cid]),
                "positive": skill_text(sid, graph),
            }
            if neg:
                row["negative"] = skill_text(neg, graph)
            pairs.append(row)
    rng.shuffle(pairs)
    write_jsonl(prep / "pairs_train.jsonl", pairs)

    save_json(
        prep / "skills.json",
        [{"id": sid, "text": skill_text(sid, graph), "domain": s["domain"], "name": s["name"]} for sid, s in skills.items()],
    )
    save_json(
        prep / "courses.json",
        [{"id": c["course_id"], "text": course_text(c), "domain": c.get("domain", "")} for c in courses],
    )
    save_json(
        prep / "resources.json",
        [{"id": r["resource_id"], "text": resource_text(r), "skill_ids": r.get("skill_ids", [])} for r in resources],
    )
    save_json(prep / "split.json", {"train": train, "holdout": sorted(holdout)})

    # ── Extra labelled texts (collect/): synthetic, HF course chunks, job posts ──
    # Same 85/15 split, by row. Rows with an empty skill list are kept as
    # explicit negatives for the tagger and skipped for retriever pairs.
    extra_rows = load_extra(skills)
    extra_pairs = 0
    extra_out = []
    for r in extra_rows:
        is_hold = rng.random() < cfg["holdout_fraction"]
        extra_out.append({**r, "split": "holdout" if is_hold else "train"})
        if is_hold:
            continue
        for sid in r["skill_ids"]:
            neg = hard_negative(sid, set(r["skill_ids"]))
            row = {"course_id": r["id"], "skill_id": sid, "anchor": r["text"], "positive": skill_text(sid, graph), "source": r["source"]}
            if neg:
                row["negative"] = skill_text(neg, graph)
            pairs.append(row)
            extra_pairs += 1
    if extra_pairs:
        rng.shuffle(pairs)
        write_jsonl(prep / "pairs_train.jsonl", pairs)
    save_json(prep / "extra.json", extra_out)
    by_source: dict[str, int] = {}
    for r in extra_rows:
        by_source[r["source"]] = by_source.get(r["source"], 0) + 1

    covered = {s for v in mapping.values() for s in v}
    uncovered = [sid for sid in skills if sid not in covered]
    stats = {
        "skills": len(skills),
        "edges": sum(len(s["prereqs"]) for s in skills.values()),
        "courses": len(courses),
        "mapped_courses": len(course_ids),
        "train_courses": len(train),
        "holdout_courses": len(holdout),
        "train_pairs": len(pairs),
        "extra_texts": len(extra_rows),
        "extra_by_source": by_source,
        "extra_pairs": extra_pairs,
        "resources": len(resources),
        "skills_without_courses": len(uncovered),
        "uncovered_skill_ids": uncovered,
    }
    save_json(prep / "stats.json", stats)
    log.info(
        "prepare: %d train pairs (%d from extra texts), %d holdout courses, %d extra texts %s, %d skills without courses",
        len(pairs),
        extra_pairs,
        len(holdout),
        len(extra_rows),
        by_source,
        len(uncovered),
    )
    return stats
