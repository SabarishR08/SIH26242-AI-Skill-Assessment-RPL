#!/usr/bin/env python
"""Generate labelled training texts per catalogue skill in the styles the
tagger meets in production (resume bullets, README paragraphs, job-posting
lines, course blurbs). Course descriptions alone would teach the tagger the
wrong register.

    python collect/synth_skill_texts.py [--per-skill 12] [--provider groq]

Resumable: skills already present in the output file are skipped.
Output: data/extra/synthetic_skill_texts.jsonl
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from collect.llm import chat, extract_json, resolve_provider  # noqa: E402
from pipeline.common import ML_ROOT, load_graph  # noqa: E402

OUT = ML_ROOT / "data" / "extra" / "synthetic_skill_texts.jsonl"

STYLES = {
    "resume_bullet": "one-line resume bullet points (start with a strong verb, mention a concrete tool or outcome)",
    "readme_paragraph": "2-3 sentence GitHub README paragraphs describing a project that uses the skill (mention stack, what it does)",
    "job_posting": "single requirement lines from a job posting for a role that needs this skill",
    "course_blurb": "1-2 sentence descriptions of a course or tutorial teaching the skill",
}


def prompt_for(skill: dict, neighbours: list[str], n_per_style: int) -> str:
    return f"""Skill: "{skill['name']}" (domain: {skill['domain']}).
Related but DIFFERENT skills you must NOT describe: {', '.join(neighbours) or 'none'}.

Write realistic English training texts about this one skill, in these styles, {n_per_style} each:
{chr(10).join(f'- {k}: {v}' for k, v in STYLES.items())}

Vary seniority, wording and tools. Mention the skill name or an unmistakable tool/technique for it in every text. No placeholders, no numbering.
Return JSON only: {{"resume_bullet": ["..."], "readme_paragraph": ["..."], "job_posting": ["..."], "course_blurb": ["..."]}}"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-skill", type=int, default=12, help="texts per skill (split across 4 styles)")
    ap.add_argument("--provider", choices=["groq", "gemini", "nvidia", "openai"])
    ap.add_argument("--limit", type=int, help="only the first N skills (testing)")
    ap.add_argument("--shard", default="0/1", help="i/n: process skills with index %% n == i (run shards on different models in parallel)")
    args = ap.parse_args()
    shard_i, shard_n = (int(x) for x in args.shard.split("/"))

    provider = resolve_provider(args.provider)
    graph = load_graph()
    skills = graph["skills"]
    n_per_style = max(1, args.per_skill // len(STYLES))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    done: set[str] = set()
    if OUT.exists():
        for line in OUT.read_text(encoding="utf-8").splitlines():
            if line.strip():
                done.add(json.loads(line)["skill_ids"][0])

    todo = [sid for i, sid in enumerate(skills) if sid not in done and i % shard_n == shard_i]
    if args.limit:
        todo = todo[: args.limit]
    print(f"provider={provider.name} model={provider.model} shard={args.shard} skills todo={len(todo)} (done {len(done)})", flush=True)

    with open(OUT, "a", encoding="utf-8") as f:
        for i, sid in enumerate(todo, 1):
            s = skills[sid]
            neighbours = [skills[x]["name"] for x in graph["by_domain"][s["domain"]] if x != sid][:6]
            t0 = time.time()
            try:
                raw = chat(provider, [{"role": "user", "content": prompt_for(s, neighbours, n_per_style)}], max_tokens=1400, temperature=0.8)
            except RuntimeError as e:
                print(f"  {sid}: {e}")
                continue
            data = extract_json(raw)
            if not isinstance(data, dict):
                print(f"  {sid}: unparsable reply, skipped")
                continue
            rows = 0
            for style in STYLES:
                for text in data.get(style, []) or []:
                    text = " ".join(str(text).split())
                    if len(text) < 25:
                        continue
                    f.write(json.dumps({"id": f"syn_{sid}_{style}_{rows}", "text": text, "skill_ids": [sid], "style": style, "source": "synthetic", "license": "generated"}, ensure_ascii=False) + "\n")
                    rows += 1
            f.flush()
            print(f"[{i}/{len(todo)}] {sid}: {rows} texts ({time.time() - t0:.1f}s)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
