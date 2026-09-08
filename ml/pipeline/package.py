"""Stage: package — manifest, human-readable report, and the zip that comes
back to the dev machine."""
from __future__ import annotations

import platform
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

from .common import ML_ROOT, gpu_info, load_json, save_json


def _versions() -> dict:
    out = {"python": sys.version.split()[0], "platform": platform.platform()}
    for name in ["torch", "transformers", "sentence_transformers", "sklearn", "numpy", "datasets", "peft", "trl"]:
        try:
            mod = __import__(name)
            out[name] = getattr(mod, "__version__", "?")
        except Exception:  # noqa: BLE001
            out[name] = None
    return out


def _fmt(d: dict, indent: int = 0) -> list[str]:
    lines = []
    for k, v in d.items():
        if isinstance(v, dict):
            lines.append("  " * indent + f"- **{k}**")
            lines.extend(_fmt(v, indent + 1))
        elif isinstance(v, list) and len(v) > 12:
            lines.append("  " * indent + f"- {k}: [{len(v)} items]")
        else:
            lines.append("  " * indent + f"- {k}: {v}")
    return lines


def write_report(out_dir: Path, run_meta: dict, results: dict) -> Path:
    lines = [f"# PathFinder ML run {run_meta['run_id']}", ""]
    lines.append(f"Started {run_meta['started_at']} · finished {run_meta['finished_at']} · smoke={run_meta['smoke']}")
    lines.append(f"GPU: {run_meta['gpu']}")
    lines.append("")
    for stage, r in results.items():
        status = r.get("status", "ok")
        secs = r.get("seconds")
        lines.append(f"## {stage} — {status}" + (f" ({secs}s)" if secs is not None else ""))
        if "error" in r:
            lines.append("```")
            lines.append(r["error"])
            lines.append("```")
        payload = {k: v for k, v in r.items() if k not in {"status", "seconds", "error"}}
        lines.extend(_fmt(payload))
        lines.append("")
    ret = results.get("retriever", {})
    if "baseline" in ret and "finetuned" in ret:
        b, f = ret["baseline"]["course_to_skill"], ret["finetuned"]["course_to_skill"]
        lines.append("## Retriever lift (course -> skill, held-out courses)")
        lines.append("")
        lines.append("| metric | base model | fine-tuned |")
        lines.append("|---|---|---|")
        for k in sorted(set(b) | set(f)):
            lines.append(f"| {k} | {b.get(k, '-')} | {f.get(k, '-')} |")
        lines.append("")
    path = out_dir / "REPORT.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def run(cfg: dict, out_dir: Path, log, run_meta: dict, results: dict) -> dict:
    run_meta["finished_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    bundle_info = ML_ROOT / "BUNDLE_INFO.json"
    manifest = {
        "schema": "pathfinder-ml-output/1",
        "run": run_meta,
        "bundle": load_json(bundle_info) if bundle_info.exists() else None,
        "versions": _versions(),
        "gpu": gpu_info(),
        "config": cfg,
        "stages": {k: {kk: vv for kk, vv in v.items() if kk != "error"} for k, v in results.items()},
        "files": [],
    }
    for tmp in out_dir.glob("tmp_*"):
        shutil.rmtree(tmp, ignore_errors=True)
    for p in sorted(out_dir.rglob("*")):
        if p.is_file():
            manifest["files"].append({"path": p.relative_to(out_dir).as_posix(), "bytes": p.stat().st_size})
    save_json(out_dir / "manifest.json", manifest)
    report = write_report(out_dir, run_meta, results)

    zip_base = out_dir.parent / f"pathfinder-ml-{run_meta['run_id']}"
    zip_path = shutil.make_archive(str(zip_base), "zip", root_dir=str(out_dir))
    size_mb = round(Path(zip_path).stat().st_size / 2**20, 1)
    log.info("package: %s (%.1f MB), report %s", zip_path, size_mb, report)
    return {"zip": zip_path, "zip_mb": size_mb, "files": len(manifest["files"])}
