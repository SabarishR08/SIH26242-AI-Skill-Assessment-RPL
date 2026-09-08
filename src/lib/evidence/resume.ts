/**
 * Resume / LinkedIn-text ingestion.
 *
 * Accepts pasted text (the privacy-first alternative to LinkedIn OAuth) or
 * an uploaded PDF. PDF text extraction runs through `unpdf`, a serverless-
 * friendly PDF.js build with no native dependencies.
 *
 * Extraction is LLM-first (maps experience to skill-graph ids with years
 * and context) with a deterministic keyword-matching fallback against the
 * real skill catalogue.
 */
import { chatJson, asArray, asString, asInt } from "@/lib/ai/llm";
import { tagTexts } from "@/lib/ml/tagger";
import type { SkillClaim } from "./types";
import type { SkillGraph } from "@/lib/engine/types";

export interface ResumeAnalysis {
  currentRole: string;
  yearsExperience: number;
  education: string;
  summary: string;
  claims: SkillClaim[];
  highlights: string[];
  mode: "llm" | "tagger" | "heuristic";
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(doc, { mergePages: true });
    return text.slice(0, 12000);
  } catch (e) {
    throw new Error(`PDF extraction failed: ${e instanceof Error ? e.message : "unknown error"}`);
  }
}

/**
 * Trained fallback: split the resume into paragraphs and run the skill
 * tagger over each, so a bullet about Django is attributed on its own terms
 * instead of needing the literal catalogue name to appear in the text.
 * Returns null when the encoder/tagger is not installed.
 */
async function taggerAnalysis(text: string, graph: SkillGraph): Promise<ResumeAnalysis | null> {
  const chunks = text
    .split(/\n\s*\n|\n(?=\s*[-•*])/)
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter((c) => c.length >= 40)
    .slice(0, 40);
  if (!chunks.length) return null;

  const tagged = await tagTexts(chunks, 6);
  if (!tagged) return null;

  // Best evidence per skill across the whole document.
  const best = new Map<string, { strength: number; probability: number; quote: string }>();
  tagged.forEach((hits, i) => {
    for (const hit of hits) {
      if (!graph.skills[hit.skillId]) continue;
      const prev = best.get(hit.skillId);
      if (!prev || hit.probability > prev.probability) {
        best.set(hit.skillId, { strength: hit.strength, probability: hit.probability, quote: chunks[i].slice(0, 220) });
      }
    }
  });
  if (!best.size) return null;

  const claims: SkillClaim[] = [...best.entries()]
    .sort((a, b) => b[1].probability - a[1].probability)
    .slice(0, 15)
    .map(([skillId, v]) => ({
      skillId,
      skillName: graph.skills[skillId].name,
      // A resume is self-report: level 2 ("used in a job/project"), matching
      // the keyword path. Only artefacts raise the evidenced level.
      level: 2,
      quote: v.quote,
      strength: v.strength,
    }));

  const yearsMatch = text.toLowerCase().match(/(\d+)\+?\s*(?:years|yrs)/);
  return {
    currentRole: "See skill matches below",
    yearsExperience: yearsMatch ? Math.min(30, parseInt(yearsMatch[1], 10)) : 0,
    education: "",
    summary: `Matched ${claims.length} catalogue skill${claims.length === 1 ? "" : "s"} across ${chunks.length} sections using the trained skill tagger.`,
    claims,
    highlights: [],
    mode: "tagger",
  };
}

function keywordHeuristic(text: string, graph: SkillGraph): ResumeAnalysis {
  const lower = text.toLowerCase();
  const claims: SkillClaim[] = [];

  // Match real skill names from the catalogue (longest names first to avoid
  // partial hits, e.g. "Deep Learning" before "Learning").
  const allSkills = Object.values(graph.skills).sort((a, b) => b.name.length - a.name.length);
  for (const skill of allSkills) {
    const name = skill.name.toLowerCase();
    if (name.length < 3) continue;
    if (lower.includes(name)) {
      claims.push({
        skillId: skill.id,
        skillName: skill.name,
        level: 2, // mentioned on a resume — claimed, not proven
        quote: `"${skill.name}" appears in the resume text`,
        strength: 2,
      });
      if (claims.length >= 15) break;
    }
  }

  const yearsMatch = lower.match(/(\d+)\+?\s*(?:years|yrs)/);
  const years = yearsMatch ? Math.min(30, parseInt(yearsMatch[1], 10)) : 0;

  return {
    currentRole: claims.length ? "See skill matches below" : "Unknown",
    yearsExperience: years,
    education: "",
    summary: `Keyword scan found ${claims.length} catalogue skill${claims.length === 1 ? "" : "s"} mentioned in the document.`,
    claims,
    highlights: [],
    mode: "heuristic",
  };
}

export async function analyzeResume(text: string, graph: SkillGraph): Promise<ResumeAnalysis> {
  const clean = text.replace(/\r/g, "").slice(0, 12000);
  const skillCatalog = Object.values(graph.skills)
    .map((s) => `${s.id}|${s.name}`)
    .join("\n");

  const result = await chatJson<ResumeAnalysis>(
    [
      { role: "system", content: "You are an honest technical recruiter screening a resume. Report only what is stated." },
      {
        role: "user",
        content: `Extract skill evidence from this resume / LinkedIn profile text.

RESUME TEXT:
"""
${clean}
"""

SKILL CATALOG (id|name) — you may ONLY use these ids:
${skillCatalog}

Return JSON:
{
  "currentRole": "most recent job title or 'Student'",
  "yearsExperience": 0,
  "education": "highest education mentioned",
  "summary": "2-3 sentence honest read of this person's background",
  "highlights": ["up to 3 notable achievements"],
  "claims": [
    { "skillId": "catalog id", "skillName": "matching name", "level": 0-5, "quote": "resume line that supports it", "strength": 1-5 }
  ]
}

Rules:
- level 0-5: 1 = mentioned as familiar, 2 = used in a job/project, 3 = used repeatedly across roles, 4 = clearly central to their roles, 5 = expert-level signals
- strength: how explicit the resume evidence is (coursework-only = 1-2, work experience = 3-4, quantified achievements = 5)
- Map tools/technologies to the closest catalogue skills. Only use catalogue ids. 5-15 claims.`,
      },
    ],
    (value) => {
      const obj = value as Record<string, unknown>;
      const claims = asArray(obj.claims)
        .map((c) => {
          const claim = c as Record<string, unknown>;
          const skillId = asString(claim.skillId);
          const node = graph.skills[skillId];
          if (!node) return null;
          return {
            skillId,
            skillName: node.name,
            level: asInt(claim.level, 1, 0, 5),
            quote: asString(claim.quote, "Resume evidence"),
            strength: asInt(claim.strength, 2, 1, 5),
          } satisfies SkillClaim;
        })
        .filter((c): c is SkillClaim => c !== null && c.level > 0)
        .slice(0, 15);
      if (!claims.length) return null;
      return {
        currentRole: asString(obj.currentRole, "Unknown"),
        yearsExperience: asInt(obj.yearsExperience, 0, 0, 40),
        education: asString(obj.education, ""),
        summary: asString(obj.summary, ""),
        claims,
        highlights: asArray(obj.highlights).map((h) => asString(h)).filter(Boolean).slice(0, 3),
        mode: "llm" as const,
      };
    },
    { maxTokens: 1400, temperature: 0.3 },
  );

  if (result) return result.value;
  // No LLM: prefer the trained tagger, fall back to the keyword scan.
  return (await taggerAnalysis(clean, graph)) ?? keywordHeuristic(clean, graph);
}
