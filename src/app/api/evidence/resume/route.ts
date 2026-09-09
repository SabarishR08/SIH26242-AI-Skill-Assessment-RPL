import { db } from "@/lib/db";
import { apiError, handleApiError, json } from "@/lib/api-helpers";
import { analyzeResume, extractPdfText } from "@/lib/evidence/resume";
import { fuseEvidence, logEvidence } from "@/lib/evidence/fuse";
import { loadSkillGraph } from "@/lib/engine/data";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  learnerId: string;
  text?: string;
}

/** Ingest resume/LinkedIn text (or PDF upload via multipart form). */
export async function POST(request: Request) {
  const rl = checkRateLimit(request, { limit: 30, windowMs: 60_000 });
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const contentType = request.headers.get("content-type") || "";
    let learnerId = "";
    let text = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      learnerId = String(form.get("learnerId") || "");
      const file = form.get("file");
      if (file instanceof File) {
        if (file.size > 5 * 1024 * 1024) return apiError("File too large (max 5MB)");
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          text = await extractPdfText(await file.arrayBuffer());
        } else {
          text = await file.text();
        }
      }
      text = text || String(form.get("text") || "");
    } else {
      const body = (await request.json()) as Body;
      learnerId = body.learnerId;
      text = body.text || "";
    }

    if (!learnerId || !text.trim()) return apiError("learnerId and resume text/file are required");

    // PF-27: Cap and truncate resume text at 50KB before forwarding to LLM
    const MAX_RESUME_TEXT_CHARS = 50_000;
    if (text.length > MAX_RESUME_TEXT_CHARS) {
      text = text.slice(0, MAX_RESUME_TEXT_CHARS);
    }

    if (text.trim().length < 80) return apiError("That text looks too short to analyse — paste the full resume/profile text (80+ characters)");

    const learner = await db.learner.findUnique({ where: { id: learnerId } });
    if (!learner) return apiError("Learner not found", 404);

    const graph = await loadSkillGraph();
    const analysis = await analyzeResume(text, graph);

    await logEvidence(
      learnerId,
      "resume",
      analysis.currentRole,
      analysis.summary || `Resume analysis: ${analysis.claims.length} skills detected`,
      analysis.claims,
    );
    const updates = await fuseEvidence(learnerId, "resume", analysis.claims);

    if (analysis.yearsExperience > 0) {
      await db.learner.update({
        where: { id: learnerId },
        data: { motivation: learner.motivation ?? `${analysis.yearsExperience}y experience, currently: ${analysis.currentRole}` },
      });
    }

    return json({
      analysis: {
        currentRole: analysis.currentRole,
        yearsExperience: analysis.yearsExperience,
        education: analysis.education,
        summary: analysis.summary,
        highlights: analysis.highlights,
        mode: analysis.mode,
        claims: analysis.claims,
      },
      assessmentUpdates: updates,
    });
  } catch (e) {
    return handleApiError(e, "Resume ingestion failed");
  }
}
