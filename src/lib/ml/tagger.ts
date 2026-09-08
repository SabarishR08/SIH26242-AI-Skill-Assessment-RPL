/**
 * Text → catalogue skill ids, offline.
 *
 * This is the trained replacement for the keyword scan that backs resume and
 * GitHub ingestion when no LLM answers. One logistic head per skill sits on
 * top of the retriever embedding (211 x 384 weights), which on held-out
 * courses scores 0.78 micro-F1 against 0.62 for plain cosine similarity, and
 * 0.69 on job-posting text.
 *
 * It needs the runtime encoder, so it returns null whenever the encoder is
 * not installed and the caller keeps its previous fallback.
 */
import { loadTaggerWeights } from "./artifacts";
import { embed } from "./encoder";

export interface TaggedSkill {
  skillId: string;
  /** Calibrated probability from the logistic head. */
  probability: number;
  /** 1-5, the shape the evidence pipeline expects. */
  strength: number;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Map a probability onto the 1-5 `strength` scale used by `SkillClaim`.
 * The threshold is the model's own operating point, so anything at the
 * threshold is a 2 and only confident predictions reach 4-5.
 */
export function strengthFor(probability: number, threshold: number): number {
  const headroom = Math.max(1e-6, 1 - threshold);
  const above = (probability - threshold) / headroom; // 0 at threshold, 1 at p=1
  return Math.max(1, Math.min(5, 2 + Math.round(above * 3)));
}

/**
 * Score one text against every skill. Returns null when the model or the
 * encoder is unavailable; an empty array means "ran, found nothing".
 */
export async function tagText(text: string, maxSkills = 15): Promise<TaggedSkill[] | null> {
  const results = await tagTexts([text], maxSkills);
  return results?.[0] ?? null;
}

/** Batched form — one encoder pass for many texts (repos, resume sections). */
export async function tagTexts(texts: string[], maxSkills = 15): Promise<TaggedSkill[][] | null> {
  const clean = texts.map((t) => t.trim()).filter(Boolean);
  if (!clean.length) return [];
  const model = await loadTaggerWeights();
  if (!model) return null;
  const vectors = await embed(clean);
  if (!vectors) return null;

  return vectors.map((vec) => {
    const hits: TaggedSkill[] = [];
    for (let s = 0; s < model.skill_ids.length; s++) {
      const row = model.W[s];
      let z = model.b[s];
      for (let d = 0; d < row.length && d < vec.length; d++) z += row[d] * vec[d];
      const probability = sigmoid(z);
      if (probability >= model.threshold) {
        hits.push({
          skillId: model.skill_ids[s],
          probability,
          strength: strengthFor(probability, model.threshold),
        });
      }
    }
    hits.sort((a, b) => b.probability - a.probability);
    return hits.slice(0, maxSkills);
  });
}
