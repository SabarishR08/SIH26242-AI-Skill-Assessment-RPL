#!/usr/bin/env python
"""Label unlabelled texts with catalogue skill ids.

Two-step: an embedding model shortlists the 20 most similar skills (cheap,
keeps prompts short), then the LLM picks the ones the text really
demonstrates (0-4). Texts where the LLM picks nothing are kept as explicit
negatives (``skill_ids: []``) — useful for the tagger's precision.

    python collect/label_with_llm.py data/extra/hf_course_chunks.jsonl
    python collect/label_with_llm.py data/extra/job_posts.jsonl --provider nvidia

Output: <input>.labelled.jsonl (resumable, batch of 8 texts per call)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from collect.llm import chat, extract_json, resolve_provider  # noqa: E402
from pipeline.common import load_graph, skill_text  # noqa: E402

BATCH = 8
SHORTLIST = 20


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--provider", choices=["groq", "gemini", "nvidia", "openai"])
    ap.add_argument("--shard", default="0/1", help="i/n: label rows with index %% n == i; shards write separate .labelled.s<i>.jsonl files")
    ap.add_argument("--encoder", default="BAAI/bge-small-en-v1.5", help="embedding model for the shortlist (a fine-tuned retriever dir works too)")
    ap.add_argument("--limit", type=int, help="first N unlabelled rows")
    ap.add_argument("--sample", type=int, help="random N rows (seeded) instead of all")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    src = Path(args.input)
    shard_i, shard_n = (int(x) for x in args.shard.split("/"))
    out = src.with_suffix(".labelled.jsonl" if shard_n == 1 else f".labelled.s{shard_i}.jsonl")
    rows = [json.loads(l) for l in src.read_text(encoding="utf-8").splitlines() if l.strip()]
    if args.sample and args.sample < len(rows):
        import random

        rows = random.Random(args.seed).sample(rows, args.sample)
    rows = [r for i, r in enumerate(rows) if i % shard_n == shard_i]
    done: set[str] = set()
    if out.exists():
        done = {json.loads(l)["id"] for l in out.read_text(encoding="utf-8").splitlines() if l.strip()}
    todo = [r for r in rows if r["id"] not in done]
    if args.limit:
        todo = todo[: args.limit]
    provider = resolve_provider(args.provider)
    print(f"provider={provider.name} model={provider.model} todo={len(todo)} done={len(done)}")
    if not todo:
        return 0

    from sentence_transformers import SentenceTransformer

    graph = load_graph()
    skills = graph["skills"]
    skill_ids = list(skills)
    enc = SentenceTransformer(args.encoder)
    S = enc.encode([skill_text(s, graph) for s in skill_ids], normalize_embeddings=True, batch_size=128)
    T = enc.encode([r["text"] for r in todo], normalize_embeddings=True, batch_size=64, show_progress_bar=True)
    sims = T @ S.T

    with open(out, "a", encoding="utf-8") as f:
        for b in range(0, len(todo), BATCH):
            batch = todo[b : b + BATCH]
            items = []
            for k, r in enumerate(batch):
                cand = [skill_ids[j] for j in np.argsort(-sims[b + k])[:SHORTLIST]]
                cand_txt = "; ".join(f"{c} = {skills[c]['name']} ({skills[c]['domain']})" for c in cand)
                hint = f"\nSkill hints from source: {r['skills_hint']}" if r.get("skills_hint") else ""
                items.append(f"### TEXT {k}\n{r['text'][:1200]}{hint}\nCANDIDATE IDS: {cand_txt}")
            prompt = (
                "For each TEXT below, choose which candidate skill ids the text clearly teaches, requires or demonstrates. "
                "Pick 0 to 4 ids per text, ONLY from that text's candidate list, only when the match is specific (not just the same broad field). "
                'Return JSON only: {"labels": [{"i": 0, "skill_ids": ["..."]}, ...]} with one entry per text.\n\n' + "\n\n".join(items)
            )
            try:
                raw = chat(provider, [{"role": "user", "content": prompt}], max_tokens=900, temperature=0.1)
            except RuntimeError as e:
                print(f"batch {b}: {e}")
                continue
            data = extract_json(raw)
            labels = {}
            if isinstance(data, dict):
                for entry in data.get("labels", []) or []:
                    try:
                        i = int(entry.get("i"))
                    except (TypeError, ValueError):
                        continue
                    ids = [s for s in (entry.get("skill_ids") or []) if s in skills]
                    labels[i] = ids[:4]
            if not labels:
                print(f"batch {b}: unparsable reply, skipped")
                continue
            for k, r in enumerate(batch):
                if k not in labels:
                    continue
                f.write(json.dumps({**r, "skill_ids": labels[k], "labeller": provider.model}, ensure_ascii=False) + "\n")
            f.flush()
            print(f"[{min(b + BATCH, len(todo))}/{len(todo)}] labelled {sum(1 for v in labels.values() if v)}/{len(batch)} positive", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
