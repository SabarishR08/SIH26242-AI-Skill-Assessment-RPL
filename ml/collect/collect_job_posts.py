#!/usr/bin/env python
"""Sample real job-posting rows (Apache-2.0, lukebarousse/data_jobs on the
Hugging Face Hub, 785k data/ML/cloud postings) through the public
datasets-server rows API, so nothing large is downloaded.

The dataset carries title + skill lists but no free-text description, so
each row becomes a short posting line ("Senior Data Engineer. Required
skills: python, sql, aws, spark."). That is exactly the register of resume
"skills" sections. Written unlabelled with the skill list as a hint; run
``label_with_llm.py`` afterwards.

    python collect/collect_job_posts.py [--n 600]

Output: data/extra/job_posts.jsonl
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.common import ML_ROOT  # noqa: E402

OUT = ML_ROOT / "data" / "extra" / "job_posts.jsonl"
DATASET = "lukebarousse/data_jobs"
ROWS = "https://datasets-server.huggingface.co/rows?dataset={ds}&config=default&split=train&offset={off}&length=100"


def fetch(offset: int) -> list[dict]:
    req = urllib.request.Request(ROWS.format(ds=DATASET, off=offset), headers={"User-Agent": "PathFinderAI-collect/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return [x["row"] for x in json.loads(r.read().decode())["rows"]]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=600)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    total = 785_000
    OUT.parent.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    n = 0
    with open(OUT, "w", encoding="utf-8") as f:
        while n < args.n:
            rows = fetch(rng.randrange(0, total - 100))
            for rec in rows:
                title = (rec.get("job_title") or "").strip()
                skills = rec.get("job_skills")
                if not title or not skills or skills == "None":
                    continue
                skills_list = [s.strip(" '\"") for s in str(skills).strip("[]").split(",") if s.strip(" '\"")]
                if len(skills_list) < 2:
                    continue
                key = f"{title}|{','.join(sorted(skills_list))}"
                if key in seen:
                    continue
                seen.add(key)
                text = f"{title}. Required skills: {', '.join(skills_list[:12])}."
                f.write(json.dumps({"id": f"job_{n}", "text": text, "title": title, "skills_hint": ", ".join(skills_list[:12]), "source": "job-post", "license": "Apache-2.0", "dataset": DATASET}, ensure_ascii=False) + "\n")
                n += 1
                if n >= args.n:
                    break
    print(f"wrote {n} postings -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
