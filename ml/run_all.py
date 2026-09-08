#!/usr/bin/env python
"""PathFinder ML — one-shot training orchestrator.

    python run_all.py                  # prepare -> retriever -> tagger -> derive -> package
    python run_all.py --smoke          # 2-minute CPU/GPU sanity run
    python run_all.py --stages lora    # stage 2 only (needs data/distill/train.jsonl)
    python run_all.py --epochs 8 --base-model BAAI/bge-base-en-v1.5

Every run writes ml/output/run-<id>/ and zips it to ml/output/pathfinder-ml-<id>.zip.
A failed stage is logged with its traceback and the remaining stages still run,
so a run always ends with a report and a zip.
"""
from __future__ import annotations

import argparse
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))

from pipeline import derive, package, prepare, train_lora, train_retriever, train_tagger  # noqa: E402
from pipeline.common import DATA_DIR, ML_ROOT, gpu_info, set_seed, setup_logging  # noqa: E402

DEFAULT_STAGES = ["prepare", "retriever", "tagger", "derive", "package"]
ALL_STAGES = ["prepare", "retriever", "tagger", "derive", "lora", "package"]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--stages", default=",".join(DEFAULT_STAGES), help="comma list from: " + ",".join(ALL_STAGES))
    ap.add_argument("--all", action="store_true", help="run every stage including lora")
    ap.add_argument("--smoke", action="store_true", help="tiny subset, 1 epoch — verifies the pipeline end to end")
    ap.add_argument("--epochs", type=int, help="override retriever epochs")
    ap.add_argument("--base-model", help="override retriever base model")
    ap.add_argument("--config", default=str(ML_ROOT / "config.yaml"))
    ap.add_argument("--out", help="output directory (default ml/output/run-<id>)")
    args = ap.parse_args()

    with open(args.config, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    if args.epochs:
        cfg["retriever"]["epochs"] = args.epochs
    if args.base_model:
        cfg["retriever"]["base_model"] = args.base_model

    stages = ALL_STAGES if args.all else [s.strip() for s in args.stages.split(",") if s.strip()]
    unknown = [s for s in stages if s not in ALL_STAGES]
    if unknown:
        print(f"unknown stage(s): {unknown}; choose from {ALL_STAGES}")
        return 2
    if "package" not in stages:
        stages.append("package")

    run_id = datetime.now().strftime("%Y%m%d-%H%M%S") + ("-smoke" if args.smoke else "")
    out_dir = Path(args.out) if args.out else ML_ROOT / "output" / f"run-{run_id}"
    out_dir.mkdir(parents=True, exist_ok=True)
    log = setup_logging(out_dir)
    set_seed(int(cfg["seed"]))

    run_meta = {
        "run_id": run_id,
        "started_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "finished_at": None,
        "smoke": args.smoke,
        "stages": stages,
        "data_dir": str(DATA_DIR),
        "gpu": gpu_info(),
        "argv": sys.argv[1:],
    }
    log.info("run %s | stages=%s | data=%s | gpu=%s", run_id, stages, DATA_DIR, run_meta["gpu"])
    with open(out_dir / "config.used.yaml", "w", encoding="utf-8") as f:
        yaml.safe_dump(cfg, f, sort_keys=False)

    results: dict[str, dict] = {}
    needs_prepared = {"retriever", "tagger", "derive"}
    if needs_prepared & set(stages) and "prepare" not in stages:
        stages.insert(0, "prepare")

    for stage in stages:
        if stage == "package":
            continue
        t0 = time.time()
        log.info("=== stage %s ===", stage)
        try:
            if stage == "prepare":
                r = prepare.run(cfg, out_dir, log)
            elif stage == "retriever":
                r = train_retriever.run(cfg, out_dir, log, smoke=args.smoke)
            elif stage == "tagger":
                r = train_tagger.run(cfg, out_dir, log, smoke=args.smoke)
            elif stage == "derive":
                r = derive.run(cfg, out_dir, log, retriever_metrics=results.get("retriever"))
            elif stage == "lora":
                r = train_lora.run(cfg, out_dir, log, smoke=args.smoke)
            else:
                continue
            r = dict(r or {})
            r.setdefault("status", "ok")
        except Exception:  # noqa: BLE001 — keep going, report everything
            r = {"status": "failed", "error": traceback.format_exc()}
            log.error("stage %s FAILED\n%s", stage, r["error"])
        r["seconds"] = round(time.time() - t0, 1)
        results[stage] = r

    pk = package.run(cfg, out_dir, log, run_meta, results)
    failed = [s for s, r in results.items() if r.get("status") == "failed"]
    print()
    print("=" * 70)
    for s, r in results.items():
        print(f"  {s:10s} {r.get('status'):8s} {r.get('seconds', 0):>7}s")
    print(f"  output   {out_dir}")
    print(f"  zip      {pk['zip']} ({pk['zip_mb']} MB)  <- send this back")
    print("=" * 70)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
