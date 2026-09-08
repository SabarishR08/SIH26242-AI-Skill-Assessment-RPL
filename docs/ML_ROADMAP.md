# PathFinder — ML audit and roadmap

_Snapshot: 2026-09-08. Stage 1 is trained and installed; the trainer lives in `ml/`, the artefacts in `data/ml/`._

## 1. Where "AI" lives today

_Section 1 describes the state at the start of the audit, before stage 1
was trained. It stays as written because it is the map of what is still
LLM-or-rules and therefore still available to improve._

At audit time there was **no trained model anywhere in the codebase**. Every
intelligent behaviour was one of two things: a prompt to a hosted 70B model
(Groq `llama-3.3-70b` first, OpenAI-compatible / NVIDIA / Z.AI fallbacks) or
a hand-tuned deterministic rule. That is a deliberate design ("AI-augmented,
not AI-dependent") and it is a strength — but it means the product's
quality ceiling is the prompt, the rules never learn, and the catalogue
data (211 skills, 2,118 courses, 51 resources) is used only as lookup
tables.

### 1a. LLM entry points (all go through `src/lib/ai/llm.ts`)

| # | Entry point | Call | Fallback when no provider | Notes |
|---|---|---|---|---|
| 1 | `src/lib/onboarding/agent.ts` — interview | Vercel AI SDK `streamText` + Groq directly (bypasses `llm.ts`) | none (route errors) | Prompt advertises four tools (`duckDuckGoSearch`, `fetchGitHubProfile`, `getTechStackTrends`, `markPhaseComplete`) that are **never registered** on `streamText`; `tool`, `search`, `z` are imported and unused. Phase never advances inside `persistAgentTurn` (`phase` is read and written back unchanged). |
| 2 | `src/lib/evidence/github.ts` — `analyzeGithub` | `chatJson` | language/topic heuristic | LLM maps repo signals → skill ids + level + quote |
| 3 | `src/lib/evidence/resume.ts` — `analyzeResume` | `chatJson` | keyword scan, level fixed at 2 | 12k-char cap |
| 4 | `src/lib/calibration/quiz.ts` — calibration + gate quizzes | `chatJson` | DAG/catalogue questions | 4 MCQs, pass at 0.75; no item bank, no reuse |
| 5 | `src/lib/projects/spec.ts` — project briefs | `chatJson` | template brief | ZPD-sized |
| 6 | `src/lib/projects/evaluate.ts` — rubric grading | `chatJson` | structural checks | 14k chars of source in the prompt |
| 7 | `src/lib/coach.ts` — weekly prose | `chatCompletion` | metrics template | |
| 8 | `src/lib/mentor.ts` — streaming tutor | `chatCompletionStream` | scripted reply | 20-turn history |
| 9 | `src/lib/explain.ts` — `explainSkill` polish | `chatCompletion` | template prose | `explainCourse`/`explainProject` are fully deterministic |

### 1b. Deterministic "models" (hand-tuned constants that could be learned)

| Component | File | Constants / rule | What would learn it |
|---|---|---|---|
| Evidence fusion | `src/lib/evidence/fuse.ts` | `SOURCE_CONFIDENCE` table, 0.7/0.3 level blend, noisy-OR, tier ladder | calibration against quiz/project outcomes |
| Competitive banding | `src/lib/evidence/competitive.ts` | LeetCode weighted thresholds 50/250/600/1200, CF rating bands | same |
| Gap detection | `src/lib/calibration/quiz.ts` `detectGaps` | `claimed − evidenced ≥ 2`, top 4 | knowledge tracing / expected-information gain |
| ZPD sizing | `src/lib/engine/zpd.ts` | 1.5–3× stretch, hours formula | per-learner from `too_hard`/`too_easy` feedback |
| Time model | `src/lib/engine/time.ts` | `months × 14 h`, clamp 6–56, `pacingFactor = 1` | actual vs. target milestone durations |
| Required level | `src/lib/engine/radar.ts` | `3 + depth/2` | — (policy, not data) |
| Course ranking | `src/lib/engine/courses.ts` | rating → viewers, level-affinity bonus | learning-to-rank on clicks/completions. **`Level` is empty for all 2,118 courses**, so the affinity bonus is dead code. |
| Course↔skill mapping | `data/course_skill_mapping.json` | precomputed offline; **45 of 211 skills have zero courses** (all of AI Engineering, Prompt Engineering, GenAI/RAG) | ✅ embedding retriever — done, see stage 1 |
| Skill search | `src/lib/engine/index.ts` `skillSearch` | substring match | ✅ neighbours + embedding search — done, see stage 1 |
| Path ordering | `src/lib/engine/topo.ts` | DFS / Kahn+SPT | keep deterministic; learn the *weights* it schedules on |
| Next-best-action | `src/app/api/dashboard/route.ts` | fixed priority ladder | bandit once there is engagement data |
| Drift trigger | `src/lib/coach.ts` | `daysSinceActivity ≥ 5` | survival model |

### 1c. Data available for learning

- **Static, today**: skill DAG (211 nodes / 227 edges, 11 domains), 2,118 Coursera courses with title/intro/skills text, rating, viewers, duration; 51 free resources; 3,465 course→skill labels.
- **Collected for the bundle (2026-09-08, `ml/data/extra/`)**: 2,382 synthetic labelled texts in resume/README/job-post/course register (all 211 skills; Groq Qwen 27B + Gemini flash-lite); 791 LLM-labelled sections of the Apache-2.0 Hugging Face LLM/Agents/smol courses, which are the only real text we have for the three AI domains; 600 LLM-labelled job-posting skill lines (Apache-2.0 `lukebarousse/data_jobs`). Rejected: roadmap.sh (personal-use licence), course-site scraping (ToS). GitHub READMEs need a token.
- **Accumulating, per learner (Prisma)**: `EvidenceItem`, `SkillAssessment` (claimed vs evidenced), `QuizAttempt` with per-question breakdown, `ProjectSubmission` with rubric scores, `FeedbackItem` (too_hard/too_easy/…), `ActivityLog`, `WeeklyReport` metrics, `MentorMessage`. None of it is used to train anything yet, and there is no export path.

## 2. Roadmap

### Stage 1 — DONE (trained 2026-09-08, artefacts in `data/ml/`)

1. **Skill/course embedding retriever** (`bge-small` fine-tune). **Trained 2026-09-08 on the RTX 5070** (run `20260907-234539`, 8 epochs, 7.4 min). Held-out course→skill recall@5 **0.57 → 0.94**, MRR **0.64 → 0.93**; on the extra text registers it never saw as courses, recall@5 is 0.77 (HF course chunks), 0.77 (job posts), 0.93 (synthetic). Artefacts installed in `data/ml/`.
2. **Text→skill tagger** (211 logistic heads over the embeddings). **Trained and wired in**: micro-F1 **0.78** on held-out courses vs 0.62 for the cosine baseline; 0.69 on job posts, 0.63 on synthetic text, 0.52 on HF course chunks. It is now the no-LLM fallback for resume ingestion (`resume.ts`, per paragraph) and GitHub ingestion (`github.ts`, per repository), replacing keyword scanning. Verified live: a RAG paragraph tags `rag_pipeline` at p=0.99, a Kubernetes/Terraform one tags `cloud_kubernetes` at p=1.00 and `cloud_devops` at 0.97.
3. **Derived catalogue artefacts** — installed and live in the engine: course→skill pairs **3,465 → 5,417** (+1,952 the retriever vouches for at ≥ 0.54), 14 of the 18 thinnest skills improved, median 15 courses/skill. 9 equivalent-skill pairs across domains and 1 suggested prerequisite edge await human review.

   Also live: **skill search** now widens substring matches with `skill_neighbors.json` and, when the encoder is installed, the embedding index — `"vector search"` and `"prompting"` returned **nothing** before and now return the right RAG/prompt-engineering skills, while literal matches still rank first. The **exploratory scenario's adjacent-skills phase** picks the goal's nearest neighbours instead of "any sibling in the same domain sorted by depth". **Equivalent skills** transfer evidence across domain duplicates (`ds_python` ⇄ `ml_python`), so proving Python once no longer has to be repeated per domain; the merge never lowers an existing assessment and discounts confidence by 10%.

   **Honest caveat**: only 3 of the 45 uncovered skills gained a genuine course. For the other 42 (all of AI Engineering / Prompt Engineering / GenAI-RAG) the Coursera catalogue simply contains no matching course — the retriever's best offers score 0.33–0.51 ("Experimental Design Basics" for prompt fundamentals). Those are filtered out and the skills fall through to their curated free resources, which cover all 42. **Fixing this needs catalogue acquisition, not a better model.**

### Stage 1b — needs a small amount of new data, GPU helpful

4. **LoRA-distilled 3B model for the JSON tasks** (`train_lora.py`, gated on `data/distill/train.jsonl`). Log `chatJson` prompt/response pairs that pass their guard, fine-tune Qwen2.5-3B, serve via Ollama through the existing OpenAI-compatible slot. Removes the rate-limit dependency for resume/GitHub extraction, quiz generation and grading.
5. **Quiz item bank + difficulty model**. Generate ~20 MCQs per skill × level offline, keep them, and fit a 2-parameter IRT model as attempts arrive. Today every quiz is regenerated and never reused, so pass/fail is not comparable across learners.
6. **GitHub level estimator** (gradient boosting on repo features: language bytes, recency, README length, topics, stars, manifest presence). Weak labels from the LLM path, then distil. Replaces the "language present ⇒ level 2" heuristic.
7. ~~**Runtime query encoder in the app**~~ — **DONE**. The int8 ONNX retriever (32 MB, from 127 MB fp32) runs in-process via transformers.js; `src/lib/ml/encoder.ts` reproduces the training recipe (CLS pooling + L2 normalise) and agrees with the trained fp32 vectors at **cosine 0.966**. It is optional and git-ignored: install with `npm run ml:install-encoder`, and every caller falls back cleanly when it is absent. Note `onnxruntime-node` ships a native binding, so it is declared in `serverExternalPackages` and will not run on Vercel's default serverless runtime — it needs a Node server or a container.

### Stage 2 — needs learner interaction data (instrument now, train later)

8. **Knowledge tracing** (BKT/IRT first, DKT later) over `QuizAttempt` + `ProjectSubmission` → per-skill mastery probability replacing the fixed `claimed − evidenced ≥ 2` gap rule and the 0.75 pass line.
9. **Per-learner time model**: regress actual milestone duration on estimate, hours/week, evidenced level → learned `pacingFactor`, honest ETAs.
10. **ZPD / scenario bandit**: use `too_hard` / `too_easy` / completion as reward to tune the stretch multiplier and course picks per learner.
11. **Momentum / churn model**: survival analysis on `ActivityLog` to fire the coach's drift trigger before the stall, not five days after.
12. **Learning-to-rank for courses and resources** from clicks, starts and completions (needs click logging — none exists today).
13. **Project-evaluation code embeddings**: embed submitted source with a code model, score rubric criteria by similarity + a small classifier, use the LLM only for the feedback prose.

### Instrumentation to add now (cheap, unblocks stage 2)

- Log every `chatJson` prompt/response that passes its guard (→ distillation set).
- Log course/resource clicks and milestone start/finish timestamps.
- Persist quiz question text + skill + level with each attempt (item bank seed).
- A `scripts/export-training-data.ts` that dumps anonymised Prisma tables to JSONL for the bundle.

## 3. Non-ML defects found during the audit

- `onboarding/agent.ts`: tools promised in the system prompt are not attached to `streamText`; phase never advances; unused imports.
- `mentor.ts` `buildContextDigest` loads the skill graph and discards it (`void graph`).
- `projects/spec.ts` deterministic brief computes `coursePicks` / `freePicks` and discards them.
- `courses.ts` level affinity is inert because `Level` is blank for every course in `data/courses.json`.
- `llm.ts` `llmConfigured()` returns `true` whenever `Z_AI_SDK_DISABLED` is unset, regardless of keys.
