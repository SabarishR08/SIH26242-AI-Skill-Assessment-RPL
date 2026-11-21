#!/usr/bin/env python
"""Build the self-contained zip bundle for training machine deployment.

Usage:
    python ml/make_bundle.py [output_dir]

Example:
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
    """Retrieve the current short git SHA for the repository.

    Returns:
        str | None: Short commit hash if git repository is present, else None.
    """
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=REPO, text=True).strip()
    except Exception:  # noqa: BLE001
        return None


def create_bundle_info(stamp: datetime) -> dict[str, str | list[str] | None]:
    """Generate metadata dictionary for BUNDLE_INFO.json.

    Args:
        stamp: Creation timestamp in UTC.

    Returns:
        Dictionary containing creation timestamp, git SHA, and bundled data file list.
    """
    return {
        "created_at": stamp.isoformat(timespec="seconds"),
        "git_sha": git_sha(),
        "data_files": DATA_FILES,
    }


def should_exclude(rel: Path, p: Path) -> bool:
    """Determine whether a file path should be excluded from the zip bundle.

    Args:
        rel: Relative path of the target file from ML_ROOT.
        p: Absolute path of the target file.

    Returns:
        bool: True if path matches exclusion directories, suffixes, or hidden files.
    """
    if any(part.startswith(".") for part in rel.parts):
        return True
    if any(part in EXCLUDE_DIRS for part in rel.parts):
        return True
    if p.suffix.lower() in EXCLUDE_SUFFIXES:
        return True
    return False


def copy_catalogue_data() -> None:
    """Copy data catalogue files from repo root data/ directory into ml/data/."""
    dst_dir = ML_ROOT / "data"
    dst_dir.mkdir(parents=True, exist_ok=True)
    src_dir = REPO / "data"
    for name in DATA_FILES:
        src = src_dir / name
        if src.exists():
            shutil.copy2(src, dst_dir / name)


def make_bundle(output_dir: Path | None = None) -> Path:
    """Build a zip archive containing ML pipeline scripts, config, and data files.

    Args:
        output_dir: Directory where the output zip file will be saved.
                   Defaults to REPO/dist if not specified.

    Returns:
        Path: Path to the generated zip file.
    """
    now = datetime.now(timezone.utc)
    copy_catalogue_data()
    info_path = ML_ROOT / "BUNDLE_INFO.json"
    with open(info_path, "w", encoding="utf-8") as f:
        json.dump(create_bundle_info(now), f, indent=2)

    out_dir = output_dir or (REPO / "dist")
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp_str = now.strftime("%Y%m%d-%H%M%S")
    zip_path = out_dir / f"pathfinder-ml-bundle-{stamp_str}.zip"

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for p in ML_ROOT.rglob("*"):
            if p.is_file():
                rel = p.relative_to(ML_ROOT)
                if not should_exclude(rel, p):
                    zf.write(p, arcname=Path("ml") / rel)

    if info_path.exists():
        info_path.unlink()

    return zip_path


def main() -> int:
    """Main entry point for building the ML bundle.

    Returns:
        int: Exit status code (0 for success).
    """
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    archive = make_bundle(out_dir)
    print(f"Bundle created: {archive} ({archive.stat().st_size / 1e6:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
