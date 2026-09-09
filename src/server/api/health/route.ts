import { db } from "@/lib/db";
import { loadEngineData } from "@/lib/engine/data";
import { json } from "@/lib/api-helpers";
import { envSummary } from "@/lib/env-check";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  try {
    await db.learner.count();
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const env = envSummary();

  let catalogue = { courses: 0, skills: 0, resources: 0 };
  try {
    const { graph, catalogue: cat, resources } = await loadEngineData();
    catalogue = { courses: cat.courses.length, skills: Object.keys(graph.skills).length, resources: resources.resources.length };
  } catch {
    /* data not loadable */
  }

  return json({
    status: "ok",
    service: "PathFinder AI",
    time: new Date().toISOString(),
    db: dbOk ? "connected" : "unavailable",
    llm: env.llmProviders.length ? env.llmProviders : "zai-sdk-or-fallback",
    gateway: env.gateway,
    catalogue,
  });
}
