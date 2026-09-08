/**
 * Runtime query encoder — the fine-tuned retriever running in-process.
 *
 * The trained artefacts (`search_index.json`, the tagger weights) are all
 * vectors in the retriever's embedding space. They are useless for arbitrary
 * text until we can embed that text at request time, which is what this
 * module does: it loads the int8 ONNX export through transformers.js and
 * reproduces the training-time recipe exactly — CLS pooling, then L2
 * normalisation (see `1_Pooling/config.json` in the run).
 *
 * It is optional by design. The model lives outside git (34 MB); when it is
 * absent every caller falls back to the behaviour it had before, so this can
 * never break a deploy that does not ship the encoder.
 *
 * Install it with:  npm run ml:install-encoder
 */
import path from "node:path";
import { promises as fs } from "node:fs";

/**
 * Resolved per call rather than captured at import, so the location stays
 * configurable after the module is loaded (tests, and any host that sets its
 * environment late).
 */
export function encoderDir(): string {
  return process.env.PATHFINDER_ENCODER_DIR || path.join(process.cwd(), "data", "ml", "encoder");
}

type FeatureExtractor = (
  texts: string[],
  options: { pooling: "cls" | "mean"; normalize: boolean },
) => Promise<{ tolist: () => number[][] }>;

let pipelinePromise: Promise<FeatureExtractor | null> | null = null;
let availability: boolean | null = null;

/** True when the ONNX encoder is installed and loadable. */
export async function encoderAvailable(): Promise<boolean> {
  if (availability !== null) return availability;
  if (process.env.PATHFINDER_ENCODER === "off") {
    availability = false;
    return availability;
  }
  try {
    const dir = encoderDir();
    await fs.access(path.join(dir, "onnx", "model_quantized.onnx"));
    await fs.access(path.join(dir, "tokenizer.json"));
    availability = true;
  } catch {
    availability = false;
  }
  return availability;
}

async function getPipeline(): Promise<FeatureExtractor | null> {
  if (pipelinePromise) return pipelinePromise;
  pipelinePromise = (async () => {
    if (!(await encoderAvailable())) return null;
    try {
      // Imported lazily so the dependency (and its native onnxruntime
      // binding) is only touched when the encoder is actually installed.
      const dir = encoderDir();
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowRemoteModels = false;
      env.localModelPath = path.dirname(dir);
      const extractor = await pipeline("feature-extraction", path.basename(dir), {
        dtype: "q8",
        local_files_only: true,
      });
      return extractor as unknown as FeatureExtractor;
    } catch (e) {
      console.warn(`[ml] encoder failed to load, falling back: ${e instanceof Error ? e.message : String(e)}`);
      availability = false;
      return null;
    }
  })();
  return pipelinePromise;
}

/**
 * Embed texts into the retriever's space (L2-normalised, so a dot product is
 * cosine similarity). Returns null when no encoder is installed — callers
 * must have a fallback.
 */
export async function embed(texts: string[]): Promise<number[][] | null> {
  if (!texts.length) return [];
  const extractor = await getPipeline();
  if (!extractor) return null;
  try {
    const output = await extractor(texts, { pooling: "cls", normalize: true });
    return output.tolist();
  } catch (e) {
    console.warn(`[ml] embedding failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** Convenience wrapper for a single string. */
export async function embedOne(text: string): Promise<number[] | null> {
  const out = await embed([text]);
  return out?.[0] ?? null;
}

/** Dot product of two equal-length vectors (cosine, for normalised inputs). */
export function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length && i < b.length; i++) sum += a[i] * b[i];
  return sum;
}

/** Test seam: forget the cached pipeline and availability probe. */
export function resetEncoder(): void {
  pipelinePromise = null;
  availability = null;
}
