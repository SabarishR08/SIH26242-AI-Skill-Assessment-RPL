/**
 * Semantic skill search — free text to catalogue skill ids, by meaning.
 *
 * `search_index.json` holds every skill as a vector in the retriever's
 * space, so once the query is embedded a single pass of dot products ranks
 * all 211 skills. That is what lets "vector search", "LLM" or "prompting"
 * find skills whose names contain none of those words.
 *
 * Returns an empty list when the encoder or the index is missing, so
 * `skillSearch` keeps its literal-match behaviour untouched.
 */
import { loadSearchIndex } from "./artifacts";
import { dot, embedOne } from "./encoder";

export interface SemanticHit {
  skillId: string;
  name: string;
  domain: string;
  score: number;
}

/**
 * Minimum cosine for a semantic hit to be offered.
 *
 * Deliberately lower than the 0.54 the retriever's course→skill F1 peaks at:
 * that threshold is calibrated for auto-assigning labels with nobody
 * checking, whereas search results are a list a human picks from, so recall
 * is worth more than precision. Measured on this index, real queries score
 * 0.65-0.77 for their best hit ("stats" → `ds_stats` 0.70, "how to be happy"
 * → `pd_happiness` 0.77), plausible-but-loose ones land near 0.45 ("money" →
 * `biz_finance`), and nonsense tops out around 0.31 ("asdfqwer" → 0.31,
 * "recipes for dinner" → 0.32). 0.45 keeps the useful tail and still floors
 * the junk.
 */
export const MIN_SEMANTIC_SCORE = 0.45;

export async function searchSkillsSemantically(
  query: string,
  limit = 10,
  minScore = MIN_SEMANTIC_SCORE,
): Promise<SemanticHit[]> {
  const q = query.trim();
  if (!q) return [];
  const index = await loadSearchIndex();
  if (!index?.skills?.length) return [];
  const vector = await embedOne(q);
  if (!vector) return [];

  const hits: SemanticHit[] = [];
  for (const skill of index.skills) {
    const score = dot(vector, skill.vec);
    if (score >= minScore) {
      hits.push({ skillId: skill.id, name: skill.name, domain: skill.domain, score });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
