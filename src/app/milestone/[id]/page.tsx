"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { QuizRunner, type QuizData, type QuizResult } from "@/components/app/QuizRunner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useLearner } from "@/hooks/use-learner";
import { api, type PathDetail } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import {
  Clock,
  PlayCircle,
  BookOpen,
  Globe,
  Hammer,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Github,
  ShieldCheck,
  XCircle,
  CheckCircle2,
  Sparkles,
  Target,
  GraduationCap,
  Award,
} from "lucide-react";

export default function MilestonePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { learnerId, hydrated } = useLearner();
  const [milestone, setMilestone] = useState<PathDetail["milestones"][number] | null>(null);
  const [path, setPath] = useState<PathDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<{
    verdict: "passed" | "needs_work";
    overallScore: number;
    checks: Array<{ criterion: string; score: number; note: string }>;
    strengths: string[];
    gaps: string[];
    feedback: string;
    evaluatorMode: string;
  } | null>(null);
  const [gateQuiz, setGateQuiz] = useState<QuizData | null>(null);
  const [quizBusy, setQuizBusy] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainText, setExplainText] = useState("");
  const [explainTitle, setExplainTitle] = useState("");

  const load = useCallback(async (showSkeleton = true) => {
    if (!learnerId || !params.id) return;
    if (showSkeleton) setLoading(true);
    try {
      const res = await api.getCurrentPath(learnerId);
      setPath(res.path);
      const m = res.path?.milestones.find((x) => x.id === params.id) ?? null;
      setMilestone(m);
      if (m?.project?.submissions?.length) {
        const latest = m.project.submissions[0];
        if (latest.evaluation) setEvaluation({ ...latest.evaluation, verdict: latest.evaluation.verdict as "passed" | "needs_work", evaluatorMode: String((latest.evaluation as Record<string, unknown>).evaluatorMode ?? "unknown") });
      }
    } catch (e) {
      toast({ title: "Failed to load milestone", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      if (showSkeleton) setLoading(false);
    }
  }, [learnerId, params.id, toast]);

  useEffect(() => {
    if (!hydrated) return;
    if (!learnerId) {
      router.push("/onboarding");
      return;
    }
    void load();
  }, [hydrated, learnerId, router, load]);

  const start = async () => {
    if (!learnerId || !milestone) return;
    setStarting(true);
    try {
      await api.startMilestone(learnerId, milestone.id);
      toast({ title: "Milestone started", description: milestone.hasProject ? "Project brief is being generated…" : "Off you go." });
      await load();
    } catch (e) {
      toast({ title: "Could not start", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const startGateQuiz = async () => {
    if (!learnerId || !milestone) return;
    setQuizBusy(true);
    try {
      const res = await api.createGateQuiz(learnerId, milestone.id);
      setGateQuiz({
        quizId: res.quiz.quizId,
        skillName: res.quiz.skillName || milestone.title,
        mode: res.quiz.mode,
        questions: res.quiz.questions,
      });
    } catch (e) {
      toast({ title: "Quiz generation failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setQuizBusy(false);
    }
  };

  const onQuizFinished = async (result: QuizResult) => {
    setGateQuiz(null);
    if (result.milestoneCompleted) {
      toast({ title: "Milestone complete", description: "All requirements passed — next phase unlocked." });
      await load(false);
    } else if (result.passed) {
      toast({
        title: "Gate quiz passed",
        description: milestone?.hasProject
          ? "Gate quiz passed! Complete and submit the project to finish this phase."
          : "Gate quiz passed!",
      });
      await load(false);
    } else if (result.replanHappened) {
      toast({
        title: "Path replanned with refresher",
        description: "Review your score and explanations below. A refresher phase has been added to your roadmap.",
        duration: 8000,
      });
      await load(false);
    } else {
      await load(false);
    }
  };

  const submitProject = async () => {
    if (!milestone?.project || !repoUrl.trim()) return;
    setSubmitting(true);
    setEvaluation(null);
    try {
      const res = await api.submitProject(milestone.project.specId, repoUrl.trim());
      setEvaluation(res.evaluation);
      if (res.milestoneCompleted) {
        toast({ title: "Phase complete", description: "Project verified and all phase requirements fulfilled!" });
      } else if (res.evaluation.verdict === "passed") {
        toast({
          title: "Project verified",
          description: milestone.hasGateQuiz
            ? `Skills marked PROVEN (${Math.round(res.evaluation.overallScore * 100)}%). Complete the gate quiz to finish this phase.`
            : `Skills marked PROVEN · score ${Math.round(res.evaluation.overallScore * 100)}%`,
        });
      } else {
        toast({ title: "Needs work", description: res.evaluation.feedback.slice(0, 140), variant: "destructive" });
      }
      await load();
    } catch (e) {
      toast({ title: "Evaluation failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const explain = async (subject: string, id: string, title: string) => {
    if (!learnerId) return;
    setExplainOpen(true);
    setExplainTitle(title);
    setExplainText("");
    try {
      const res = await api.explain(learnerId, subject, id);
      setExplainText(res.explanation.prose);
    } catch {
      setExplainText("Explanation unavailable right now.");
    }
  };

  if (!hydrated || loading) {
    return (
      <AppShell>
        <div className="space-y-4 max-w-4xl mx-auto">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!milestone || !path) {
    return (
      <AppShell>
        <Card className="glass-card max-w-lg mx-auto mt-16">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground">Milestone not found on your active path.</p>
            <Button asChild><Link href="/path">← Back to roadmap</Link></Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const project = milestone.project;
  const started = milestone.status === "in_progress" || milestone.status === "complete";

  return (
    <AppShell learnerName={null}>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <Card className="glass-card">
          <CardContent className="pt-5 pb-4">
            <Link href="/path" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3">
              <ArrowLeft className="h-3 w-3" /> Roadmap
            </Link>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{milestone.phase}</Badge>
                  {milestone.hasProject && (
                    <Badge variant="outline" className="border-violet-500/40 text-violet-300 bg-violet-500/10">
                      <Hammer className="mr-1 h-2.5 w-2.5" /> project phase
                    </Badge>
                  )}
                  <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5">
                    {milestone.status.replace("_", " ")}
                  </Badge>
                </div>
                <h1 className="text-xl font-semibold tracking-tight mt-2">{milestone.title}</h1>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{milestone.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {milestone.skillNames.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-xs cursor-pointer hover:border-primary/50" onClick={() => explain("skill", milestone.skillIds[i], s)}>
                      {s} <Sparkles className="ml-1 h-2.5 w-2.5 text-primary/60" />
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end"><Clock className="h-3 w-3" /> ~{milestone.estimatedHours}h</p>
                {milestone.targetEndAt && <p className="text-xs text-muted-foreground mt-1">target {milestone.targetEndAt.slice(0, 10)}</p>}
                {milestone.status === "available" && (
                  <Button className="mt-3" onClick={start} disabled={starting}>
                    {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                    Start phase
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project */}
        {milestone.hasProject && project && (
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Hammer className="h-4 w-4 text-violet-400" /> Project — {project.title}
              </CardTitle>
              <div className="flex flex-wrap gap-2 mt-1">
                <Badge variant="outline" className="text-[10px]">ZPD ×{project.zpd.stretchMultiplier.toFixed(2)}</Badge>
                <Badge variant="outline" className="text-[10px]">difficulty {project.zpd.targetDifficulty}/5</Badge>
                <Badge variant="outline" className="text-[10px]">~{project.zpd.estimatedHours}h</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed">{project.brief}</p>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Requirements (graded as-is)</p>
                <ul className="space-y-1.5">
                  {project.requirements.map((r, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-primary font-mono text-xs mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                      <span className="leading-relaxed">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Rubric</p>
                <div className="flex flex-wrap gap-2">
                  {project.rubric.map((r, i) => (
                    <Badge key={i} variant="secondary" className="text-xs font-normal">
                      {r.criterion} · {Math.round(r.weight * 100)}%
                    </Badge>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed border-l-2 border-primary/40 pl-3 py-1">
                {project.zpd.rationale}
              </p>

              {/* Submission */}
              {started && (
                <div className="pt-2 border-t border-border/60">
                  <p className="text-sm font-medium flex items-center gap-2 mb-2">
                    <Github className="h-4 w-4" /> Submit your repository
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://github.com/you/your-project"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitProject()}
                    />
                    <Button onClick={submitProject} disabled={submitting || !repoUrl.trim()} className="shrink-0">
                      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {submitting ? "Evaluating…" : "Evaluate"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    The evaluator fetches your repo (public GitHub), reads the code, and grades against the rubric. Pass = skills PROVEN.
                  </p>

                  {project.submissions.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {project.submissions.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <a href={s.repoUrl} target="_blank" rel="noreferrer" className="truncate hover:text-foreground underline">
                            {s.repoUrl.replace("https://github.com/", "")}
                          </a>
                          <span className="flex items-center gap-1.5 shrink-0">
                            {s.status === "passed" ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <XCircle className="h-3 w-3 text-destructive" />}
                            {new Date(s.submittedAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Evaluation result */}
              {evaluation && (
                <div className={cn("rounded-xl border p-4", evaluation.verdict === "passed" ? "border-emerald-500/50 bg-emerald-500/5" : "border-amber-500/50 bg-amber-500/5")}>
                  <div className="flex items-center gap-2 mb-3">
                    {evaluation.verdict === "passed" ? (
                      <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-amber-400" />
                    )}
                    <p className="font-semibold">
                      {evaluation.verdict === "passed" ? "Verified — skills PROVEN" : "Needs work"}
                    </p>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {Math.round(evaluation.overallScore * 100)}% · {evaluation.evaluatorMode}
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed mb-3">{evaluation.feedback}</p>
                  <div className="space-y-2">
                    {evaluation.checks.map((c, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span>{c.criterion}</span>
                          <span className={cn("font-mono", c.score >= 0.65 ? "text-emerald-400" : c.score >= 0.4 ? "text-amber-400" : "text-destructive")}>
                            {Math.round(c.score * 100)}%
                          </span>
                        </div>
                        <div className="h-1 rounded bg-secondary overflow-hidden">
                          <div
                            className={cn("h-full", c.score >= 0.65 ? "bg-emerald-500" : c.score >= 0.4 ? "bg-amber-500" : "bg-destructive")}
                            style={{ width: `${Math.round(c.score * 100)}%` }}
                          />
                        </div>
                        {c.note && <p className="text-[11px] text-muted-foreground mt-0.5">{c.note}</p>}
                      </div>
                    ))}
                  </div>
                  {(evaluation.strengths.length > 0 || evaluation.gaps.length > 0) && (
                    <div className="grid sm:grid-cols-2 gap-3 mt-3 text-xs">
                      {evaluation.strengths.length > 0 && (
                        <div>
                          <p className="font-semibold text-emerald-300 mb-1">Strengths</p>
                          <ul className="space-y-1 text-muted-foreground">
                            {evaluation.strengths.map((s, i) => <li key={i}>• {s}</li>)}
                          </ul>
                        </div>
                      )}
                      {evaluation.gaps.length > 0 && (
                        <div>
                          <p className="font-semibold text-amber-300 mb-1">Gaps</p>
                          <ul className="space-y-1 text-muted-foreground">
                            {evaluation.gaps.map((g, i) => <li key={i}>• {g}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Courses */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" /> Recommended courses
            </CardTitle>
            <p className="text-xs text-muted-foreground">Real catalogue entries — rating-ranked, level-matched to your evidence.</p>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {Object.entries(milestone.courses).map(([skillId, courses]) => (
                <AccordionItem key={skillId} value={skillId}>
                  <AccordionTrigger className="text-sm py-2">
                    {milestone.skillNames[milestone.skillIds.indexOf(skillId)] ?? skillId}
                    <Badge variant="secondary" className="ml-2 text-[10px]">{courses.length}</Badge>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    {courses.map((c) => (
                      <div key={c.courseId} className="rounded-lg border border-border/60 p-3 hover:border-primary/40 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <a href={c.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:text-primary leading-snug flex items-center gap-1">
                              {c.title} <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {c.site} {c.rating && <>· ★ {c.rating}</>} {c.duration && <>· {c.duration}</>} {c.level && <>· {c.level}</>}
                            </p>
                          </div>
                          <button
                            className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 shrink-0 mt-1"
                            onClick={() => explain("course", c.courseId, c.title)}
                          >
                            <Sparkles className="h-3 w-3" /> why?
                          </button>
                        </div>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Free resources */}
        {milestone.resources.length > 0 && (
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> Free resources
              </CardTitle>
              <p className="text-xs text-muted-foreground">Curated, zero-cost material for this phase&apos;s skills.</p>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {milestone.resources.map((r) => (
                <a
                  key={r.resource_id}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-border/60 p-3 hover:border-primary/40 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium leading-tight">{r.title}</p>
                    <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary shrink-0" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                  <div className="flex gap-1.5 mt-2">
                    <Badge variant="secondary" className="text-[9px]">{r.format}</Badge>
                    <Badge variant="secondary" className="text-[9px]">{r.difficulty}</Badge>
                  </div>
                </a>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Phase completion checklist */}
        {(milestone.hasGateQuiz || milestone.hasProject) && milestone.status !== "complete" && started && (
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Phase Completion Checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {milestone.hasGateQuiz && (
                <div className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0">
                  <span className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" /> Gate Quiz (75% to pass)
                  </span>
                  {milestone.gateQuiz?.status === "passed" ? (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Passed
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Required</Badge>
                  )}
                </div>
              )}
              {milestone.hasProject && (
                <div className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0">
                  <span className="flex items-center gap-2">
                    <Hammer className="h-4 w-4 text-violet-400" /> Project Evaluation
                  </span>
                  {milestone.project?.submissions.some((s) => s.status === "passed") ? (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Passed
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Required</Badge>
                  )}
                </div>
              )}
              {milestone.hasGateQuiz && milestone.hasProject && (
                <p className="text-[11px] text-muted-foreground pt-1">
                  Both the gate quiz and the project must be completed to unlock the next phase.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Gate quiz */}
        {milestone.hasGateQuiz && started && milestone.status !== "complete" && !gateQuiz && (
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Gate quiz
              </CardTitle>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Four questions across this phase&apos;s skills, pitched at independent-use level. Pass (75%) to complete the phase — fail and the plan inserts remediation automatically.
              </p>
            </CardHeader>
            <CardContent>
              {milestone.gateQuiz?.status === "passed" ? (
                <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Gate quiz passed — skills verified</span>
                </div>
              ) : (
                <Button onClick={startGateQuiz} disabled={quizBusy}>
                  {quizBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Award className="mr-2 h-4 w-4" />}
                  {milestone.gateQuiz ? "Retake gate quiz" : "Generate gate quiz"}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {gateQuiz && milestone.status !== "complete" && (
          <QuizRunner
            quiz={gateQuiz}
            onSubmit={(qid, answers) => api.submitQuiz(qid, answers, learnerId ?? undefined)}
            onFinished={onQuizFinished}
            title="Gate quiz"
          />
        )}

        {milestone.status === "complete" && (
          <Card className="glass-card border-emerald-500/40">
            <CardContent className="pt-5 pb-4 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              <div>
                <p className="font-medium">Phase complete</p>
                <p className="text-sm text-muted-foreground">
                  {milestone.completedAt ? `Finished ${new Date(milestone.completedAt).toLocaleDateString()}` : ""} — skills verified.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Explain modal */}
      <Dialog open={explainOpen} onOpenChange={setExplainOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" /> Why {explainTitle}?
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm leading-relaxed text-muted-foreground">{explainText || <Loader2 className="h-4 w-4 animate-spin" />}</div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
