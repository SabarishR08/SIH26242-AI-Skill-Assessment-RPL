#!/usr/bin/env python
"""Build the self-contained zip that goes to the training machine.

    python ml/make_bundle.py            # -> dist/pathfinder-ml-bundle-<date>.zip

Copies the current data/ catalogue into ml/data, stamps BUNDLE_INFO.json
with the git sha, and zips ml/ without venvs, caches or previous outputs.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parent
REPO = ML_ROOT.parent
EXCLUDE_DIRS = {".venv", "venv", "output", "__pycache__", ".pytest_cache", "models_cache", "trained"}
# Never re-bundle archives (a downloaded bundle or a returned run left in ml/
# would otherwise be swept into the next one).
EXCLUDE_SUFFIXES = {".zip", ".tar", ".gz", ".7z", ".npy", ".safetensors"}
DATA_FILES = ["skill_graph.json", "courses.json", "course_skill_mapping.json", "free_resources_mapping.json"]


def git_sha() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=REPO, text=True).strip()
    except Exception:  # noqa: BLE001
        return None


def main() -> int:
    (ML_ROOT / "data").mkdir(exist_ok=True)
    for name in DATA_FILES:
        shutil.copy2(REPO / "data" / name, ML_ROOT / "data" / name)

    stamp = datetime.now(timezone.utc)
    info = {"created_at": stamp.isoformat(timespec="seconds"), "git_sha": git_sha(), "data_files": DATA_FILES}
    (ML_ROOT / "BUNDLE_INFO.json").write_text(json.dumps(info, indent=2), encoding="utf-8")

    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO / "dist"
    out_dir.mkdir(parents=True, exist_ok=True)
    zip_path = out_dir / f"pathfinder-ml-bundle-{stamp.strftime('%Y%m%d')}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in ML_ROOT.rglob("*"):
            rel = p.relative_to(ML_ROOT)
            if any(part in EXCLUDE_DIRS for part in rel.parts) or not p.is_file():
                continue
            if p.suffix.lower() in EXCLUDE_SUFFIXES:
                continue
            zf.write(p, Path("pathfinder-ml") / rel)
    print(f"bundle: {zip_path} ({zip_path.stat().st_size / 2**20:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
