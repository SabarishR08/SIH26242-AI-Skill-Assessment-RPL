#!/usr/bin/env python
"""Collect real, Apache-2.0 course text for the AI / LLM domains that the
Coursera catalogue does not cover at all: the Hugging Face LLM course,
Agents course and smol-course. Sections are chunked by heading and written
unlabelled; run ``label_with_llm.py`` afterwards.

    python collect/collect_hf_courses.py

Output: data/extra/hf_course_chunks.jsonl
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.common import ML_ROOT  # noqa: E402

OUT = ML_ROOT / "data" / "extra" / "hf_course_chunks.jsonl"

SOURCES = [
    ("huggingface/course", ["chapters/en"], "https://github.com/huggingface/course/blob/main/"),
    ("huggingface/agents-course", ["units/en"], "https://github.com/huggingface/agents-course/blob/main/"),
    ("huggingface/smol-course", ["."], "https://github.com/huggingface/smol-course/blob/main/"),
]
MIN_CHARS, MAX_CHARS = 300, 1400


def clean_mdx(text: str) -> str:
    text = re.sub(r"<Tip[^>]*>|</Tip>|<Youtube[^>]*/>|<[^>\n]{1,80}>", " ", text)
    text = re.sub(r"\[\[[^\]]*\]\]|\[![A-Za-z]+\]", " ", text)  # [[anchors]] and [!TIP] callouts
    text = re.sub(r"```[\s\S]*?```", " ", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"\{[^}]*\}", " ", text)
    text = re.sub(r"[*_`>#|]+", " ", text)
    return " ".join(text.split())


def chunks_from_markdown(md: str) -> list[tuple[str, str]]:
    out = []
    title = ""
    buf: list[str] = []
    for line in md.splitlines():
        if line.startswith("#"):
            if buf:
                out.append((title, "\n".join(buf)))
            title = line.lstrip("#").strip()
            buf = []
        else:
            buf.append(line)
    if buf:
        out.append((title, "\n".join(buf)))
    return out


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    tmp = Path(tempfile.mkdtemp(prefix="pf-hf-"))
    try:
        for repo, subdirs, url_base in SOURCES:
            dest = tmp / repo.split("/")[1]
            print(f"cloning {repo} ...")
            subprocess.run(["git", "clone", "-q", "--depth", "1", "--filter=blob:none", f"https://github.com/{repo}.git", str(dest)], check=True)
            files = []
            for sub in subdirs:
                base = dest / sub
                files += [p for p in base.rglob("*.md*") if p.suffix in {".md", ".mdx"} and "_toctree" not in p.name]
            for p in sorted(files):
                rel = p.relative_to(dest).as_posix()
                if rel.lower().startswith(("readme", "code_of_conduct", "contributing", "license")) or "/pt/" in rel or "/zh" in rel or "/es/" in rel:
                    continue
                if any(seg in rel for seg in ["/ko/", "/ja/", "/fr/", "/de/", "/vi/", "/ru/", "/th/", "/tr/", "/hi/", "/bn/", "/it/", "/id/"]):
                    continue
                md = p.read_text(encoding="utf-8", errors="ignore")
                for idx, (title, body) in enumerate(chunks_from_markdown(md)):
                    text = clean_mdx(body)
                    if len(text) < MIN_CHARS:
                        continue
                    text = text[:MAX_CHARS]
                    if title:
                        text = f"{clean_mdx(title)}. {text}"
                    rows.append({"id": f"hf_{repo.split('/')[1]}_{rel}#{idx}", "text": text, "source": "hf-course", "repo": repo, "url": url_base + rel, "license": "Apache-2.0"})
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    with open(OUT, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"wrote {len(rows)} chunks -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
