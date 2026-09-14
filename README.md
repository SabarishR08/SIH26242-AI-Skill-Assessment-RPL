# PathFinder AI

**Learning paths built on proof, not vibes.**

An evidence-based adaptive learning path engine: multi-round AI onboarding,
real skill verification from GitHub/LeetCode/Codeforces, deterministic
graph-based roadmaps, project verification, and replanning that reacts to
your progress.

---

## What it does

Most recommenders ask one question and guess the rest. PathFinder interviews
you, audits your actual GitHub and competitive-programming record, calibrates
what you claim against what you can prove, then generates a verifiable roadmap
that adapts as you learn.

### The closed loop

```
   ┌───────────────────────────────────────────────────────────────────┐
   │                                                                   │
   ▼                                                                   │
① Prove ─► ② Calibrate ─► ③ Plan ─► ④ Build ─► ⑤ Verify ──────────────┘
GitHub        gap analysis    graph engine    resources    project code
resume        adaptive quiz    milestones      + mentor       + rubric
LeetCode      skill radar      multi-scenario  + projects
multi-round   tiers            ZPD-sized       assessment
interview
```

Every recommendation answers "why?" with three grounds: your **evidence**,
the **graph** structure, and your **goal** — plus the counterfactual.

---

## Feature inventory

### Evidence-based onboarding

- **Multi-round streaming interview agent** — Nexus asks adaptive questions
 one at a time, fills gaps in your profile based on what you've already said.
 Pausable state machine persisted server-side; refresh-safe.
- **GitHub ingestion** — repos, languages, READMEs, topics, activity,
 fetched via the GitHub REST API. LLM maps signals to skill-graph ids with
 per-skill evidence quotes; deterministic language/topic heuristic as a
 graceful fallback.
- **Resume / LinkedIn text** — paste-or-upload (privacy-first; no OAuth).
 LLM extraction with deterministic keyword matching against the skill
 catalogue as fallback. PDF parsing via `unpdf`.
- **LeetCode** — public GraphQL endpoint; solved-counts (E/M/H weighted)
 convert to an evidenced algorithm level.
- **Codeforces** — official REST API; rating bands map to algorithm +
 data-structure levels.
- **Evidence fusion** — every claim lands on one of four tiers:
 `proven` (GitHub artefacts, contests, project pass) >
 `verified` (quiz pass) > `claimed` (self-report) > `inferred` (weak).
 Noisy-OR confidence combination across independent sources.

### Calibration

- **Gap detection** — any skill where claimed − evidenced ≥ 2 (a big
 self-report with thin proof) is a calibration candidate.
- **Quiz generation** — LLM produces 4 MCQs pitched at the *claimed* level
 (level 5 claim → level 5 questions, not level-1 trivia). Deterministic
 fallback derives real questions from the prerequisite DAG and course
 catalogue.
- **Honest grading** — pass raises evidenced level to the claim and stamps
 the `verified` tier; fail drops it and flags remediation. The plan
 adjusts; nothing silently breaks.

### Path generation (the deterministic core)

- **Prerequisite DAG** — 211 skills across 11 domains with prerequisite
 edges (some cross-domain).
- **Two ordering algorithms**:
 - DFS post-order topological sort — stable, easy to reason about.
 - Kahn's algorithm + min-heap applying the **Shortest-Processing-Time**
 scheduling rule (Smith's rule from operations research). When several
 skills become simultaneously available, the shorter one is scheduled
 first — front-loads quick wins, minimises average completion time.
- **Course matching** — TF-IDF precomputed mapping (skill → courses),
 runtime ranking by rating desc then viewers desc, with level-affinity
 bonus toward the learner's evidenced band.
- **Time model** — real per-skill durations from the catalogue, converted
 to work-hour estimates; weekly budget drives deterministic milestone
 scheduling.
- **Three scenarios** — `balanced` (DFS + project every other phase),
 `intensive` (Kahn/SPT, compressed), `exploratory` (DFS + adjacent-skills
 phase + capstone).
- **ZPD calibration** — every project is sized at 1.5–3× the learner's
 evidenced level (Vygotsky's zone of proximal development, algorithmically
 enforced). Below 1.5× is busywork; above 3× collapses into frustration.

### Milestones, projects & verification

- **Milestone phases** grouped by graph depth; each carries skills,
 recommended courses, free resources, optional project, optional gate quiz.
- **Project specs** generated LLM-first (calibrated to ZPD) with a
 deterministic brief assembler as fallback. Each spec has weighted rubric
 criteria and an expected stack.
- **Project verification loop** — submit a repo URL; the evaluator fetches
 real evidence (metadata, language mix, README, file tree, top source
 files, dependency manifests) and grades against the rubric. LLM path
 produces per-criterion scores + strengths/gaps + targeted feedback;
 heuristic path checks structural signals (stack match, README, code
 substance) when no LLM is reachable. Pass → skills stamped PROVEN, the
 strongest tier, milestone completes, next phase unlocks.
- **Gate quizzes** — 4 MCQs per milestone covering the phase's skills,
 pitched at independent-use level. Pass to complete; fail → automatic
 remediation phase inserted before re-attempt.

### Adaptive replanning

- Triggers: quiz failures, feedback (`too_hard` / `too_easy` /
 `too_theoretical` / `not_relevant`), goal change, momentum drift.
- Every replan produces a **path diff** (added / removed / reordered phases
 with reasons) shown to the learner — no silent reshuffles.
- Completed milestones preserved across replans; progress never regresses.

### Mentor & coach

- **Streaming mentor chat** — grounded in your real profile, path state,
 recent activity, current milestone. Socratic mode toggle (guides with
 questions instead of answering).
- **Weekly coach** — honest persona reports generated from real activity
 metrics (milestones completed, quizzes passed/failed, projects,
 streak, slippage). LLM polish with a deterministic metrics summary
 fallback.

### Dashboard

- **React Flow skill DAG** — interactive prerequisite graph with mastered /
 available / current / locked states. Click any node for an evidence-cited
 explanation.
- **Skill radar** — claimed vs evidenced vs required (3-series Recharts
 radar). Exposes both the over-claim surface and the genuine gap.
- **Momentum** — 4-week activity bars.
- **Next-best-actions** — deterministic priority ladder (calibrate, start
 milestone, submit project, take gate quiz, generate path, …).
- **Evidence timeline** and **activity feed**.

### Everywhere: explainability

- Every skill / course / project recommendation answers "why?" with
 evidence citations, graph reasons, goal alignment, and the counterfactual.
- LLM polishes prose when available; deterministic template assembly
 otherwise — explanations never silently disappear.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript 5 |
| UI | Tailwind CSS 4, shadcn/ui (New York style), Lucide icons, Framer Motion |
| Database | Prisma ORM + PostgreSQL (Supabase) |
| Visualisation | React Flow (`@xyflow/react`) for the skill DAG, Recharts for radar/momentum |
| AI | Multi-provider LLM gateway: Groq → OpenAI-compatible (NVIDIA, OpenRouter, OpenAI) → optional Z.AI SDK |
| PDF | `unpdf` (serverless-friendly PDF.js build, no native deps) |
| State | React 19 + `useSyncExternalStore` for the learner identity |

### Design principle: AI-augmented, not AI-dependent

Every LLM call has a deterministic fallback. The engine, path generation,
quiz generation, project evaluation, mentor and coach all degrade
gracefully — the product stays functional when no provider is configured.
LLMs make it conversational; math handles planning.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in any optional LLM keys:

```bash
cp .env.example .env.local
```

| Variable | Purpose | Required? |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase pooler) | yes |
| `GROQ_API_KEY` | Groq provider (primary). Free at console.groq.com | optional (recommended) |
| `OPENAI_API_KEY` + `OPENAI_BASE` | Any OpenAI-compatible (OpenRouter, Together, NVIDIA, local Ollama) | optional |
| `NVIDIA_API_KEY` | NVIDIA NIM endpoint | optional |
| `GITHUB_TOKEN` | Raises GitHub rate limit from 60/h to 5,000/h | optional |

If no LLM key is set, all AI features gracefully degrade to deterministic
fallbacks — onboarding still runs (scripted interview), path generation
still works (engine is pure TS), quizzes and project evaluation use the
heuristic paths.

### 3. Initialise the database

```bash
npx prisma db push
```

### 4. Run

```bash
npm run dev
# → http://localhost:3000
```

### 5. Regenerate the course catalogue (optional)

The `data/courses.json` file is committed and ready. If you want to
regenerate from the raw CSV:

```bash
npx tsx scripts/convert-courses.ts
```

---

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Landing — the closed-loop narrative
│   ├── layout.tsx            # Dark theme + PathFinder branding
│   ├── onboarding/page.tsx   # 6-stage wizard (interview → evidence → calibration → scenarios)
│   ├── dashboard/page.tsx    # React Flow DAG + radar + coach + next actions
│   ├── path/page.tsx         # Roadmap + time simulator + replan diff
│   ├── milestone/[id]/page.tsx  # Courses, resources, project, quiz
│   ├── mentor/page.tsx       # Streaming mentor chat
│   └── api/                  # ~25 route handlers
├── components/app/           # AppShell, SkillGraph, SkillRadar, QuizRunner
├── components/ui/            # shadcn/ui component set
├── lib/
│   ├── engine/               # Pure TS: graph, topo (DFS + Kahn/SPT), courses, time, radar, ZPD
│   ├── ai/llm.ts             # Multi-provider gateway + JSON repair + SSE streaming
│   ├── evidence/             # GitHub, resume, LeetCode, Codeforces, fusion
│   ├── onboarding/agent.ts   # Multi-round streaming agent state machine
│   ├── calibration/quiz.ts   # Gap detection + quiz generation + grading
│   ├── path/                 # generate.ts (scenarios + milestones) + replan.ts (diffing)
│   ├── projects/             # spec.ts (ZPD briefs) + evaluate.ts (rubric grading)
│   ├── explain.ts            # Evidence-cited explanations
│   ├── mentor.ts             # Context-grounded streaming mentor
│   ├── coach.ts              # Weekly metrics + honest reports
│   ├── client-api.ts         # Typed client wrappers + SSE stream consumption
│   └── api-helpers.ts        # JSON + SSE helpers
├── hooks/use-learner.ts      # localStorage-backed identity (useSyncExternalStore)
└── types/

data/
├── skill_graph.json          # 211 skills across 11 domains, prerequisite edges
├── courses.json              # 2,118 real Coursera courses (ETL output)
├── course_skill_mapping.json # course_id → skill_id[] (TF-IDF matched)
└── free_resources_mapping.json # Curated free resources indexed by skill

scripts/
├── convert-courses.ts        # CSV → JSON ETL (RFC-4180 CSV parser, Python-list parsing)
└── test-engine.ts            # Engine smoke test (algorithms + radar + search)
```

---

## API reference (selected)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Service health + catalogue stats + LLM provider inventory |
| `POST` | `/api/onboarding/start` | Create learner + agent state; returns the greeting |
| `POST` | `/api/onboarding/message` | Streaming interview turn (SSE) |
| `GET` | `/api/onboarding/state` | Current agent phase + history + extracted profile |
| `POST` | `/api/evidence/github` | Ingest GitHub profile + repo analysis |
| `POST` | `/api/evidence/resume` | Ingest resume text or PDF (multipart) |
| `POST` | `/api/evidence/leetcode` | Ingest LeetCode solved-counts |
| `POST` | `/api/evidence/codeforces` | Ingest Codeforces rating |
| `GET` | `/api/evidence/list` | All evidence items for a learner |
| `GET` | `/api/profile/radar` | Claimed vs evidenced vs required + calibration gaps |
| `POST` | `/api/profile/skills` | Set self-reported (claimed) levels |
| `GET` | `/api/calibration/gaps` | Calibration candidates |
| `POST` | `/api/calibration/quiz` | Generate a calibration quiz for a gap skill |
| `GET` | `/api/quiz/[id]` | Fetch quiz with questions (no answers leaked) |
| `POST` | `/api/quiz/[id]/submit` | Submit answers → grade → tier updates + side effects |
| `POST` | `/api/quiz/gate` | Create (or return existing) milestone gate quiz |
| `POST` | `/api/path/scenarios` | Preview 3 scenarios (no persistence) |
| `POST` | `/api/path/generate` | Generate and persist the active path |
| `GET` | `/api/path/current` | Active path with full milestone detail + DAG edges |
| `POST` | `/api/path/replan` | Feedback-triggered replan with diff |
| `POST` | `/api/path/goal` | Change goal → regenerate path |
| `POST` | `/api/milestones/[id]/start` | Mark in_progress + lazily generate project spec |
| `POST` | `/api/milestones/[id]/feedback` | Pace feedback → optional replan |
| `POST` | `/api/milestones/[id]/complete` | Manual completion (ungated phases only) |
| `POST` | `/api/projects/spec` | Ensure (lazily generate) the project spec for a milestone |
| `POST` | `/api/projects/[id]/submit` | Submit repo URL → evaluate → verdict + skill update |
| `POST` | `/api/explain` | Evidence-cited explanation (skill / course / project) |
| `POST` | `/api/mentor` | Streaming mentor reply (SSE) |
| `GET` | `/api/mentor` | Mentor chat history |
| `GET` | `/api/dashboard` | Aggregated dashboard payload |
| `GET` | `/api/weekly` | Generate (or return cached) the coach report |

---

## Data sources

- `data/skill_graph.json` — 211 hand-curated skills with prerequisite edges.
- `data/courses_clean.csv` — 2,118 real Coursera course titles, ratings,
 durations, skills tags.
- `data/course_skill_mapping.json` — TF-IDF character n-gram cosine
 similarity matching (precomputed; the runtime never re-derives it).
- `data/free_resources_mapping.json` — 51 curated free resources
 (official docs, interactive playgrounds, readings) indexed by skill.

Re-derive the catalogue with `npx tsx scripts/convert-courses.ts`.

---

## License

MIT.
