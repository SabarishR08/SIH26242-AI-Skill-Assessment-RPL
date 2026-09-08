"""Stage: derive — turn embeddings into the JSON artefacts the Next.js app
consumes with no runtime model:

  course_skill_mapping.v2.json   superset of the current mapping; every skill
                                 gets >= N courses (fixes the 45 uncovered
                                 AI-domain skills)
  skill_course_scores.v2.json    per-skill ranked courses with scores/sources
  resource_skill_mapping.v2.json free resources extended the same way
  skill_neighbors.json           top-k similar skills (adjacent-skills phase,
                                 semantic search expansion)
  course_neighbors.json          top-k similar courses ("alternatives" in
                                 explainCourse)
  suggested_edges.json           candidate prerequisite edges for human review
  search_index.json              skill vectors for semantic skill search
  coverage.json                  before/after coverage stats
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from .common import ancestors, compute_depths, load_graph, load_json, load_mapping, load_resources, save_json


def run(cfg: dict, out_dir: Path, log, retriever_metrics: dict | None = None) -> dict:
    dcfg = cfg["derive"]
    emb = out_dir / "embeddings"
    ids = load_json(emb / "ids.json")
    S = np.load(emb / "skills.npy")
    C = np.load(emb / "courses.npy")
    R = np.load(emb / "resources.npy")
    graph = load_graph()
    skills = graph["skills"]
    mapping = load_mapping()
    resources = load_resources()
    depths = compute_depths(skills)

    skill_ids: list[str] = ids["skills"]
    course_ids: list[str] = ids["courses"]
    resource_ids: list[str] = ids["resources"]
    sidx = {s: i for i, s in enumerate(skill_ids)}

    # Prefer this run's metrics; fall back to the ones the retriever stage
    # persisted (so `--stages derive` reproduces a full run); only then the
    # default.
    metrics = retriever_metrics
    if not metrics and (out_dir / "retriever_metrics.json").exists():
        metrics = load_json(out_dir / "retriever_metrics.json")
        log.info("derive: reusing retriever_metrics.json from a previous stage")
    threshold = float((metrics or {}).get("finetuned", {}).get("cosine_tagging", {}).get("threshold", 0.6))
    if not metrics:
        log.warning("derive: no retriever metrics found - using default threshold %.2f", threshold)
    log.info("derive: cosine threshold %.2f", threshold)

    art = out_dir / "artifacts"
    art.mkdir(parents=True, exist_ok=True)

    # ── course <-> skill mapping v2 ──────────────────────────────────────
    sims = C @ S.T
    per_skill: dict[str, dict[str, tuple[float, str]]] = {s: {} for s in skill_ids}
    for i, cid in enumerate(course_ids):
        for s in mapping.get(cid, []):
            if s in sidx:
                per_skill[s][cid] = (float(sims[i, sidx[s]]), "existing")
    added_semantic = 0
    max_add = int(dcfg["courses_per_skill_max"])
    for j, sid in enumerate(skill_ids):
        order = np.argsort(-sims[:, j])
        added = 0
        for i in order:
            if sims[i, j] < threshold or added >= max_add:
                break
            cid = course_ids[i]
            if cid not in per_skill[sid]:
                per_skill[sid][cid] = (float(sims[i, j]), "semantic")
                added += 1
                added_semantic += 1
    fallback = 0
    min_c = int(dcfg["courses_per_skill_min"])
    for j, sid in enumerate(skill_ids):
        if len(per_skill[sid]) >= min_c:
            continue
        for i in np.argsort(-sims[:, j]):
            cid = course_ids[i]
            if cid not in per_skill[sid]:
                per_skill[sid][cid] = (float(sims[i, j]), "fallback")
                fallback += 1
            if len(per_skill[sid]) >= min_c:
                break

    mapping_v2: dict[str, list[str]] = {cid: list(v) for cid, v in mapping.items()}
    for sid, courses in per_skill.items():
        for cid, (_, src) in courses.items():
            if src != "existing":
                mapping_v2.setdefault(cid, [])
                if sid not in mapping_v2[cid]:
                    mapping_v2[cid].append(sid)
    save_json(art / "course_skill_mapping.v2.json", {k: mapping_v2[k] for k in sorted(mapping_v2)}, indent=None)
    save_json(
        art / "skill_course_scores.v2.json",
        {
            sid: [
                {"courseId": cid, "score": round(sc, 4), "source": src}
                for cid, (sc, src) in sorted(courses.items(), key=lambda kv: -kv[1][0])
            ]
            for sid, courses in per_skill.items()
        },
        indent=None,
    )

    # ── resources v2 ─────────────────────────────────────────────────────
    if len(resource_ids):
        rs = R @ S.T
        max_r = int(dcfg["resources_per_skill_max"])
        by_res = {r["resource_id"]: list(r.get("skill_ids", [])) for r in resources}
        for j, sid in enumerate(skill_ids):
            count = sum(1 for rid in resource_ids if sid in by_res.get(rid, []))
            for i in np.argsort(-rs[:, j]):
                if rs[i, j] < threshold or count >= max_r:
                    break
                rid = resource_ids[i]
                if sid not in by_res[rid]:
                    by_res[rid].append(sid)
                    count += 1
        save_json(art / "resource_skill_mapping.v2.json", by_res, indent=None)

    # ── neighbours ───────────────────────────────────────────────────────
    ss = S @ S.T
    k = int(dcfg["skill_neighbors"])
    skill_neighbors = {}
    for j, sid in enumerate(skill_ids):
        order = [i for i in np.argsort(-ss[j]) if i != j][:k]
        skill_neighbors[sid] = [
            {
                "skillId": skill_ids[i],
                "name": skills[skill_ids[i]]["name"],
                "domain": skills[skill_ids[i]]["domain"],
                "score": round(float(ss[j, i]), 4),
            }
            for i in order
        ]
    save_json(art / "skill_neighbors.json", skill_neighbors, indent=None)

    cc = C @ C.T
    kc = int(dcfg["course_neighbors"])
    course_neighbors = {}
    for i, cid in enumerate(course_ids):
        order = [x for x in np.argsort(-cc[i]) if x != i][:kc]
        course_neighbors[cid] = [{"courseId": course_ids[x], "score": round(float(cc[i, x]), 4)} for x in order]
    save_json(art / "course_neighbors.json", course_neighbors, indent=None)

    # ── suggested prerequisite edges ─────────────────────────────────────
    thr = float(dcfg["edge_sim_threshold"])
    anc = {sid: ancestors(skills, sid) for sid in skill_ids}
    edges = []
    equivalents = []  # same skill living in two domains (ds_python / ml_python ...) — not a prerequisite
    for a_i, a in enumerate(skill_ids):
        for b_i in range(a_i + 1, len(skill_ids)):
            b = skill_ids[b_i]
            score = float(ss[a_i, b_i])
            if score < thr:
                continue
            if a in anc[b] or b in anc[a]:
                continue  # already connected through the DAG
            if skills[a]["name"].strip().lower() == skills[b]["name"].strip().lower():
                equivalents.append({"a": a, "b": b, "name": skills[a]["name"], "score": round(score, 4)})
                continue
            da, db = depths[a], depths[b]
            if da == db:
                continue
            src, dst = (a, b) if da < db else (b, a)
            edges.append(
                {
                    "from": src,
                    "to": dst,
                    "fromName": skills[src]["name"],
                    "toName": skills[dst]["name"],
                    "score": round(score, 4),
                    "crossDomain": skills[src]["domain"] != skills[dst]["domain"],
                    "reason": f"embedding similarity {score:.2f}; depth {depths[src]} -> {depths[dst]}; no existing DAG path",
                }
            )
    edges.sort(key=lambda e: -e["score"])
    edges = edges[: int(dcfg["max_suggested_edges"])]
    save_json(art / "suggested_edges.json", edges)
    equivalents.sort(key=lambda e: -e["score"])
    save_json(art / "equivalent_skills.json", equivalents)

    # ── semantic search index ────────────────────────────────────────────
    save_json(
        art / "search_index.json",
        {
            "model": ids["model"],
            "dim": ids["dim"],
            "skills": [
                {"id": sid, "name": skills[sid]["name"], "domain": skills[sid]["domain"], "vec": np.round(S[j], 4).tolist()}
                for j, sid in enumerate(skill_ids)
            ],
        },
        indent=None,
    )

    # ── coverage ─────────────────────────────────────────────────────────
    before = {s for v in mapping.values() for s in v}
    after = {s for v in mapping_v2.values() for s in v}
    coverage = {
        "threshold": threshold,
        "skills_total": len(skill_ids),
        "skills_with_courses_before": len(before & set(skill_ids)),
        "skills_with_courses_after": len(after & set(skill_ids)),
        "pairs_before": sum(len(v) for v in mapping.values()),
        "pairs_after": sum(len(v) for v in mapping_v2.values()),
        "added_semantic": added_semantic,
        "added_fallback": fallback,
        "suggested_edges": len(edges),
        "cross_domain_edges": sum(1 for e in edges if e["crossDomain"]),
        "equivalent_skill_pairs": len(equivalents),
    }
    save_json(art / "coverage.json", coverage)
    log.info("derive: %s", coverage)
    return coverage
