import { db } from "@/lib/db";
import { apiError, json } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/** Fetch a quiz with its questions (no answers leaked). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const quiz = await db.quiz.findUnique({ where: { id }, include: { questions: true } });
    if (!quiz) return apiError("Quiz not found", 404);
    const ordered = [...quiz.questions].sort((a, b) => a.order - b.order);
    return json({
      quiz: {
        id: quiz.id,
        kind: quiz.kind,
        skillId: quiz.skillId,
        skillName: quiz.skillName,
        milestoneId: quiz.milestoneId,
        status: quiz.status,
        passScore: quiz.passScore,
        questions: ordered.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          options: JSON.parse(q.optionsJson) as string[],
          skillFocus: q.skillFocus,
        })),
      },
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Failed to load quiz", 500);
  }
}
