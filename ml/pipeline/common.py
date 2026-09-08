"""Shared helpers: paths, logging, data loading, text templates.

Data resolution: ``ml/data`` (bundled copy, used on the training box) wins;
otherwise fall back to the repo's ``data/`` directory so the pipeline also
runs in-place from the monorepo.
"""
from __future__ import annotations

import json
import logging
import random
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np

ML_ROOT = Path(__file__).resolve().parents[1]
_BUNDLED = ML_ROOT / "data"
_REPO = ML_ROOT.parent / "data"
DATA_DIR = _BUNDLED if (_BUNDLED / "skill_graph.json").exists() else _REPO


def setup_logging(out_dir: Path) -> logging.Logger:
    out_dir.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("pathfinder-ml")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s", "%H:%M:%S")
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    fh = logging.FileHandler(out_dir / "train.log", encoding="utf-8")
    fh.setFormatter(fmt)
    logger.addHandler(sh)
    logger.addHandler(fh)
    return logger


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    try:
        import torch

        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)
    except ImportError:
        pass


def device_name() -> str:
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
    except ImportError:
        pass
    return "cpu"


def gpu_info() -> dict[str, Any]:
    try:
        import torch

        if torch.cuda.is_available():
            p = torch.cuda.get_device_properties(0)
            return {
                "name": p.name,
                "vram_gb": round(p.total_memory / 2**30, 1),
                "cuda": torch.version.cuda,
                "torch": torch.__version__,
            }
        return {"name": "cpu", "torch": torch.__version__}
    except ImportError:
        return {"name": "cpu", "torch": None}


def load_json(path: Path) -> Any:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, obj: Any, indent: int | None = 2) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent)


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def read_jsonl(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


class Timer:
    def __init__(self) -> None:
        self.t0 = time.time()

    def elapsed(self) -> float:
        return round(time.time() - self.t0, 1)


# ─── Data ────────────────────────────────────────────────────────────────────


def load_graph() -> dict[str, Any]:
    raw = load_json(DATA_DIR / "skill_graph.json")
    skills: dict[str, dict] = {}
    by_domain: dict[str, list[str]] = {}
    for domain, items in raw.items():
        by_domain[domain] = []
        for s in items:
            skills[s["id"]] = {
                "id": s["id"],
                "name": s["name"],
                "prereqs": list(s.get("prereqs", [])),
                "domain": domain,
            }
            by_domain[domain].append(s["id"])
    dependents: dict[str, list[str]] = {sid: [] for sid in skills}
    for s in skills.values():
        for p in s["prereqs"]:
            if p in dependents:
                dependents[p].append(s["id"])
    return {"skills": skills, "domains": list(raw.keys()), "by_domain": by_domain, "dependents": dependents}


def compute_depths(skills: dict[str, dict]) -> dict[str, int]:
    indeg = {sid: 0 for sid in skills}
    deps: dict[str, list[str]] = {sid: [] for sid in skills}
    for s in skills.values():
        for p in s["prereqs"]:
            if p in skills:
                indeg[s["id"]] += 1
                deps[p].append(s["id"])
    depth = {sid: 0 for sid, d in indeg.items() if d == 0}
    queue = list(depth.keys())
    while queue:
        cur = queue.pop(0)
        for nxt in deps[cur]:
            depth[nxt] = max(depth.get(nxt, 0), depth[cur] + 1)
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                queue.append(nxt)
    for sid in skills:
        depth.setdefault(sid, 0)
    return depth


def ancestors(skills: dict[str, dict], sid: str) -> set[str]:
    seen: set[str] = set()
    stack = [sid]
    while stack:
        cur = stack.pop()
        if cur in seen:
            continue
        seen.add(cur)
        stack.extend(p for p in skills.get(cur, {}).get("prereqs", []) if p in skills)
    seen.discard(sid)
    return seen


def load_courses() -> list[dict]:
    return load_json(DATA_DIR / "courses.json")["courses"]


def load_mapping() -> dict[str, list[str]]:
    return load_json(DATA_DIR / "course_skill_mapping.json")


def load_resources() -> list[dict]:
    return load_json(DATA_DIR / "free_resources_mapping.json")["resources"]


def _clip(text: str, n: int) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= n else text[: n - 1] + "..."


def course_text(c: dict) -> str:
    parts = [c.get("Title", "")]
    if c.get("ShortIntro"):
        parts.append(_clip(c["ShortIntro"], 400))
    if c.get("Skills"):
        parts.append("Skills: " + _clip(c["Skills"], 200))
    cat = " / ".join(x for x in [c.get("Category"), c.get("SubCategory")] if x)
    if cat:
        parts.append("Category: " + cat)
    return " ".join(p.strip().rstrip(".") + "." for p in parts if p)


def skill_text(sid: str, graph: dict) -> str:
    s = graph["skills"][sid]
    pre = [graph["skills"][p]["name"] for p in s["prereqs"] if p in graph["skills"]]
    post = [graph["skills"][d]["name"] for d in graph["dependents"].get(sid, [])]
    text = f"{s['name']} ({s['domain']})."
    if pre:
        text += " Builds on: " + ", ".join(pre[:4]) + "."
    if post:
        text += " Leads to: " + ", ".join(post[:4]) + "."
    return text


def resource_text(r: dict) -> str:
    parts = [r.get("title", "")]
    if r.get("description_raw"):
        parts.append(_clip(r["description_raw"], 300))
    meta = ", ".join(x for x in [r.get("resource_type"), r.get("format"), r.get("difficulty")] if x)
    if meta:
        parts.append(meta)
    return ". ".join(p.strip().rstrip(".") for p in parts if p) + "."
