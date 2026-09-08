# PathFinder ML — training bundle

Self-contained trainer for the models PathFinder can learn from its own
catalogue. Runs on the RTX 5070 box; the zip it produces comes back to the
dev machine and its JSON artefacts drop into `data/ml/`.

## One-click run

| Platform | Command |
|---|---|
| Windows | double-click `run.bat` (or `run.bat --smoke`) |
| Linux / WSL | `./run.sh` (or `./run.sh --smoke`) |

The launcher creates `.venv`, installs PyTorch with the **cu128** wheel
(the 5070 is Blackwell / sm_120 and needs torch ≥ 2.7), installs
`requirements.txt`, then runs `run_all.py`. Measured on the 5070:
**7.4 minutes** for the full 8-epoch run. `--smoke` is a two-minute sanity pass.

Everything lands in **`output/run-<id>/`** and is zipped to
**`output/pathfinder-ml-<id>.zip`** — that zip is the deliverable.

Useful flags (pass to `run.bat` / `run.sh` / `run_all.py`):

```
--smoke                       tiny subset, verifies the pipeline
--epochs 8                    more retriever epochs
--base-model BAAI/bge-base-en-v1.5    bigger encoder (still fits easily)
--stages retriever,derive     subset of stages
--all                         include the LoRA stage (needs data/distill/train.jsonl)
```

### If the launcher fails

`run.bat` never uses `activate.bat` and never calls bare `pip`/`python` — it
finds an interpreter with `py -3.13 … -3.10`, then drives everything through
`.venv\Scripts\python.exe -m pip`. So these are the remaining cases:

| Message | Cause / fix |
|---|---|
| `No Python found` | Install Python 3.13 from python.org with "Add python.exe to PATH" ticked. |
| `Existing .venv is broken/incomplete - recreating` | Normal recovery after an interrupted run (Ctrl+C during setup). Let it run. |
| `Could not create a virtual environment` | Run `py -3.13 -m ensurepip --upgrade`, then retry. |
| `PyTorch install failed` | Behind a proxy, set `HTTPS_PROXY`. If your Python is very new and has no cu128 wheel yet, install 3.13. (Python 3.14.7 + torch 2.11.0+cu128 is known to work.) |
| `GPU: NONE - training on CPU` | The cu128 torch didn't take. Delete `.venv` and re-run; a full CPU run takes hours instead of minutes. |

Deleting the `.venv` folder and re-running is always a safe reset.

## What gets trained (stage 1, runs today)

| Stage | Model / method | Supervision | Output |
|---|---|---|---|
| `prepare` | — | `course_skill_mapping.json` split 85/15 by course | `prepared/` |
| `retriever` | bi-encoder fine-tune (`bge-small-en-v1.5`, MNR loss, same-domain hard negatives) | 2.9k course→skill pairs | `models/retriever/`, `embeddings/*.npy`, optional ONNX |
| `tagger` | one logistic head per skill on the retriever embeddings | same pairs, evaluated vs cosine baseline | `models/tagger/weights.json` |
| `derive` | pure numpy over the embeddings | — | `artifacts/*.json` (see below) |
| `package` | — | — | `manifest.json`, `REPORT.md`, zip |

`REPORT.md` shows base-model vs fine-tuned metrics on held-out courses, so a
run is only worth shipping if the fine-tuned column is better.

## Artefacts the app consumes (`artifacts/`)

| File | Used for |
|---|---|
| `course_skill_mapping.v2.json` | superset of `data/course_skill_mapping.json`. Note: it pads every skill to ≥ 3 rows, but rows marked `fallback` are low-score filler — the app filters them (see `skill_course_scores.v2.json`) |
| `skill_course_scores.v2.json` | **the file the app actually uses** — per-skill ranked courses with `score` + `source` (existing / semantic / fallback). Keep `existing` plus `score >= 0.54`; drop the rest |
| `resource_skill_mapping.v2.json` | free resources extended the same way |
| `skill_neighbors.json` | top-8 similar skills → semantic search expansion, exploratory "adjacent skills" phase |
| `course_neighbors.json` | top-5 similar courses → real alternatives in `explainCourse` counterfactuals |
| `suggested_edges.json` | candidate prerequisite edges for human review (never auto-applied) |
| `equivalent_skills.json` | same skill living in two domains (e.g. `ds_python` / `ml_python`) — evidence for one should transfer to the other |
| `search_index.json` | skill vectors for semantic `skillSearch` (needs a query encoder at runtime — ONNX export + transformers.js) |
| `coverage.json` | before/after stats |

### Bringing a run back

1. Unzip `pathfinder-ml-<id>.zip` into `ml/trained/run/` (git-ignored).
2. `npm run ml:install-encoder` — copies `artifacts/*.json` + `manifest.json`
   into `data/ml/`, quantizes the ONNX retriever to int8 (127 MB → 32 MB) as
   the runtime encoder, and installs the tagger weights. Needs
   `pip install onnx onnxruntime`.
3. Everything is picked up automatically:

   | Artefact | Where it lands |
   |---|---|
   | `skill_course_scores.v2.json` | `coursesForSkill` in the catalogue loader (vouched rows only) |
   | `resource_skill_mapping.v2.json` | free resources per skill |
   | `skill_neighbors.json` | `skillSearch` expansion + exploratory adjacent-skills phase |
   | `equivalent_skills.json` | evidence transfer across domain duplicates in `fuse.ts` |
   | `search_index.json` + encoder | semantic `skillSearch` |
   | `tagger_weights.json` + encoder | no-LLM resume / GitHub skill extraction |

4. Keep `models/` and `embeddings/` out of git (large); they are the inputs
   for the encoder install and for the next training run.

The encoder is optional. Without it, semantic search and the tagger switch
off and the app behaves exactly as it did before — but note that
`onnxruntime-node` is a native binding, so it needs a Node server or
container, not Vercel's default serverless runtime.

## Training data (`data/`)

| File | Rows | What | Licence |
|---|---|---|---|
| `course_skill_mapping.json` + `courses.json` | 3,465 pairs / 2,118 courses | the app's own catalogue (Coursera export) | project data |
| `extra/synthetic_skill_texts.jsonl` | 2,382 (all 211 skills) | resume bullets, README paragraphs, job-posting lines, course blurbs per catalogue skill, generated with Groq Qwen 27B + Gemini flash-lite (`collect/synth_skill_texts.py`) | generated |
| `extra/hf_course_chunks.labelled*.jsonl` | 791 | sections of the Hugging Face LLM / Agents / smol courses — real text for the AI, prompt-engineering and RAG domains the Coursera catalogue lacks | Apache-2.0 |
| `extra/job_posts.labelled.jsonl` | 600 | title + skill lines from `lukebarousse/data_jobs` (785k data/ML postings) | Apache-2.0 |

The extra texts exist because the tagger runs on resumes and READMEs, not
course blurbs; course-only training teaches it the wrong register. Every
extra source is split 85/15 and reported separately in `REPORT.md`, so a
model that only memorised course text is visible.

Re-collect or extend with the `collect/` scripts (they need one LLM key from
the repo `.env`; all are resumable):

```
python collect/synth_skill_texts.py --per-skill 12          # labelled at generation
python collect/collect_hf_courses.py                        # unlabelled chunks
python collect/collect_job_posts.py --n 600                 # unlabelled postings
python collect/label_with_llm.py data/extra/hf_course_chunks.jsonl --sample 800 --provider gemini --shard 0/3   # run shards on different models in parallel
python collect/label_with_llm.py data/extra/job_posts.jsonl --provider gemini
```

Gemini flash-lite (`--provider gemini`, key `GEMINI_API_KEY`) was ~10x faster than the Groq free tier for labelling; Groq thinking models (`qwen3.6`, `gpt-oss-20b`) waste the token budget on reasoning and are best avoided. `label_with_llm.py` shortlists 20 candidate skills with the embedding model
and lets the LLM pick 0–4, so prompts stay short and labels stay inside the
catalogue. Sources that were considered and rejected: roadmap.sh content
(personal-use-only licence), scraped course sites (terms of service).
GitHub READMEs are the next best real source but need a `GITHUB_TOKEN`
(60 requests/hour without one).

## Stage 2 — LoRA distillation (gated)

`train_lora.py` QLoRA-tunes `Qwen2.5-3B-Instruct` on the exact JSON tasks
the app sends to its 70B provider (resume extraction, GitHub mapping, quiz
generation, rubric grading, project briefs). It runs only when
`data/distill/train.jsonl` exists, one JSON object per line:

```json
{"messages": [{"role":"system","content":"..."},{"role":"user","content":"..."},{"role":"assistant","content":"{...json...}"}]}
```

Collect it on the dev side by logging `chatJson` prompt/response pairs that
passed their guard (the guard is the quality filter). A few thousand rows is
enough for a 3B model to match the 70B on these narrow tasks. After training,
merge and convert for Ollama:

```
pip install -r requirements-lora.txt
python -c "from peft import AutoPeftModelForCausalLM as M; m=M.from_pretrained('output/run-<id>/models/lora-adapter'); m.merge_and_unload().save_pretrained('merged')"
# then llama.cpp: python convert_hf_to_gguf.py merged --outfile pathfinder-3b.gguf --outtype q8_0
```

The app already talks to Ollama through `OPENAI_BASE=http://localhost:11434/v1`.

## Layout

```
ml/
  run.bat / run.sh        one-click launchers
  run_all.py              orchestrator (stages, smoke, overrides)
  make_bundle.py          builds the zip that goes TO the training box
  config.yaml             hyper-parameters
  data/                   bundled catalogue copy (refreshed by make_bundle)
  pipeline/               prepare, train_retriever, train_tagger, derive, train_lora, package
  output/                 runs + zips (git-ignored)
```
