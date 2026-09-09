"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { SkillRadar } from "@/components/app/SkillRadar";
import { SkillGraph } from "@/components/app/SkillGraph";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLearner } from "@/hooks/use-learner";
import { api, type DashboardData } from "@/lib/client-api";
import { markdownToHtml } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Flame,
  CalendarClock,
  Clock,
  Target,
  Sparkles,
  Loader2,
  BrainCircuit,
  RefreshCw,
  ShieldCheck,
  Award,
  Activity,
  ChevronRight,
  Route as RouteIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { SkillPassportModal } from "@/components/profile/SkillPassportModal";

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  generate_path: RouteIcon,
  calibrate: ShieldCheck,
  connect_github: Sparkles,
  start_milestone: ArrowRight,
  submit_project: Award,
  gate_quiz: Target,
};

const ACTIVITY_LABELS: Record<string, string> = {
  evidence_added: "Evidence connected",
  quiz_passed: "Quiz passed",
  quiz_failed: "Quiz attempt",
  calibrated: "Skill calibrated",
  milestone_started: "Milestone started",
  milestone_completed: "Milestone completed",
  project_passed: "Project verified",
  project_needs_work: "Project feedback",
  path_generated: "Path generated",
  path_replanned: "Path replanned",
  feedback: "Feedback given",
  goal_changed: "Goal changed",
};

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { learnerId, setLearnerId, hydrated } = useLearner();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainText, setExplainText] = useState<string>("");
  const [explainLoading, setExplainLoading] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);
  const [sharedPassportId, setSharedPassportId] = useState<string | null>(null);
  const [pathEdges, setPathEdges] = useState<Array<[string, string]>>([]);
  const [pathSkills, setPathSkills] = useState<Array<{ id: string; name: string; domain: string; depth: number; hours: number }>>([]);
  const [masteredSkills, setMasteredSkills] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const p =
        params.get("shareToken") ||
        params.get("token") ||
        params.get("passport") ||
        params.get("passportId") ||
        params.get("learner");
      if (p) {
        setSharedPassportId(p);
        setPassportOpen(true);
      }
    }
  }, []);

  const activeLearnerId = sharedPassportId || learnerId;

  const load = useCallback(async () => {
    if (!activeLearnerId) return;
    setLoading(true);
    try {
      const [dash, pathRes] = await Promise.all([
        api.getDashboard(activeLearnerId),
        api.getCurrentPath(activeLearnerId).catch(() => ({ path: null })),
      ]);
      setData(dash);
      if (pathRes.path) {
        setPathEdges(pathRes.path.edges);
        setPathSkills(pathRes.path.skills);
        // mastered = skills inside completed milestones
        const completedSkills = pathRes.path.milestones
          .filter((m) => m.status === "complete")
          .flatMap((m) => m.skillIds);
        setMasteredSkills(completedSkills);
      }
    } catch (e) {
      toast({ title: "Failed to load dashboard", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeLearnerId, toast]);

  useEffect(() => {
    if (!hydrated) return;
    if (sharedPassportId) {
      void load();
      return;
    }
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("passport") || params.get("learner")) return;
    }
    if (!learnerId) {
      router.push("/onboarding");
      return;
    }
    void load();
  }, [hydrated, learnerId, sharedPassportId, router, load]);

  const explainSkill = async (skillId: string) => {
    if (!activeLearnerId) return;
    setExplainOpen(true);
    setExplainLoading(true);
    setExplainText("");
    try {
      const res = await api.explain(activeLearnerId, "skill", skillId);
      setExplainText(res.explanation.prose);
    } catch {
      setExplainText("Explanation unavailable right now.");
    } finally {
      setExplainLoading(false);
    }
  };

  const generateWeekly = async () => {
    if (!learnerId) return;
    try {
      const res = await api.getWeekly(learnerId);
      setData((d) => (d ? { ...d, weekly: { weekOf: String(res.metrics.weekOf), content: res.content, metrics: res.metrics as Record<string, unknown> } } : d));
    } catch (e) {
      toast({ title: "Report failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  if (!hydrated || loading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <Card className="glass-card max-w-lg mx-auto mt-16">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground">Couldn&apos;t load your profile. It may have been reset.</p>
            <Button onClick={() => { setLearnerId(null); router.push("/onboarding"); }}>Start over</Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const { learner, path, skills, radar, actions, activity, momentum, metrics } = data;
  const streak = Number(metrics.streakDays ?? 0);

  return (
    <AppShell learnerName={learner.name} onReset={sharedPassportId ? undefined : () => { setLearnerId(null); router.push("/onboarding"); }}>
      {sharedPassportId && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 p-3.5 text-sm shadow-sm backdrop-blur-md min-w-0 max-w-full">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Award className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground break-words">
                Viewing Verifiable Skill Passport for <span className="text-primary font-semibold">{learner.name}</span> (Read-Only Preview)
              </p>
              <p className="text-xs text-muted-foreground break-words">
                Cryptographically authenticated record backed by code challenges and project evaluations
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPassportOpen(true)} className="h-8 text-xs border-primary/30">
              <Award className="mr-1.5 h-3.5 w-3.5 text-primary" /> View Credential
            </Button>
            <Button size="sm" asChild className="h-8 text-xs">
              <Link href="/onboarding">
                Create Your Roadmap <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Top Welcome & Actions Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 min-w-0 max-w-full">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex flex-wrap items-center gap-2">
            <span>{sharedPassportId ? `${learner.name}'s Competency Profile` : `Welcome back, ${learner.name}`}</span>
            {learner.targetRole && (
              <Badge variant="secondary" className="text-xs font-normal">
                {learner.targetRole}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 break-words">
            {learner.goalStatement || "Track your competency roadmap, calibrated skills, and verifiable credentials."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPassportOpen(true)}
            className="border-primary/40 text-primary hover:bg-primary/10 shadow-sm text-xs sm:text-sm"
          >
            <Award className="mr-1.5 h-4 w-4" /> View Skill Passport
          </Button>
          {!sharedPassportId && (
            <Button variant="outline" size="sm" asChild className="text-xs sm:text-sm">
              <Link href="/path">
                <RouteIcon className="mr-1.5 h-4 w-4" /> My Roadmap
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Header stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6 min-w-0 max-w-full">
        <Card className="glass-card min-w-0 max-w-full overflow-hidden">
          <CardContent className="pt-5 pb-4 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Path progress</p>
                <p className="text-2xl font-semibold">
                  {path ? `${path.progress.percent}%` : "—"}
                </p>
                {path && (
                  <p className="text-[11px] text-muted-foreground">
                    {path.progress.completed}/{path.progress.total} phases · v{path.version}
                  </p>
                )}
              </div>
              <RouteIcon className="h-8 w-8 text-primary/60 shrink-0" />
            </div>
            {path && <Progress value={path.progress.percent} className="h-1.5 mt-3" />}
          </CardContent>
        </Card>
        <Card className="glass-card min-w-0 max-w-full overflow-hidden">
          <CardContent className="pt-5 pb-4 flex items-center justify-between min-w-0 overflow-hidden">
            <div>
              <p className="text-xs text-muted-foreground">Proven skills</p>
              <p className="text-2xl font-semibold text-primary">{skills.tiers.proven}</p>
              <p className="text-[11px] text-muted-foreground">
                +{skills.tiers.verified} verified · +{skills.tiers.claimed} claimed
              </p>
            </div>
            <ShieldCheck className="h-8 w-8 text-primary/60 shrink-0" />
          </CardContent>
        </Card>
        <Card className="glass-card min-w-0 max-w-full overflow-hidden">
          <CardContent className="pt-5 pb-4 flex items-center justify-between min-w-0 overflow-hidden">
            <div>
              <p className="text-xs text-muted-foreground">Learning streak</p>
              <p className="text-2xl font-semibold">{streak}d</p>
              <p className="text-[11px] text-muted-foreground">{learner.hoursPerWeek}h/week budget</p>
            </div>
            <Flame className={cn("h-8 w-8 shrink-0", streak > 0 ? "text-amber-400" : "text-muted-foreground/40")} />
          </CardContent>
        </Card>
        <Card className="glass-card min-w-0 max-w-full overflow-hidden">
          <CardContent className="pt-5 pb-4 flex items-center justify-between min-w-0 overflow-hidden">
            <div className="min-w-0 flex-1 mr-2">
              <p className="text-xs text-muted-foreground">Next milestone</p>
              <p className="text-sm font-semibold leading-tight mt-0.5 truncate">
                {path?.nextMilestone ? path.nextMilestone.title : "All done — replan?"}
              </p>
              {path?.nextMilestone?.targetEnd && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1 truncate">
                  <CalendarClock className="h-3 w-3 shrink-0" /> target {path.nextMilestone.targetEnd}
                </p>
              )}
            </div>
            <Clock className="h-8 w-8 text-primary/60 shrink-0" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-6 min-w-0 max-w-full">
        {/* Next best actions */}
        <Card className="glass-card min-w-0 max-w-full overflow-hidden">
          <CardHeader className="pb-2 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" /> Next best actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 min-w-0 overflow-hidden">
            {actions.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing urgent — keep going at your pace.</p>
            )}
            {actions.slice(0, 5).map((a, i) => {
              const Icon = ACTION_ICONS[a.kind] ?? ArrowRight;
              return (
                <button
                  key={i}
                  className="w-full max-w-full min-w-0 flex items-center gap-2.5 sm:gap-3 rounded-lg border border-border/60 p-2.5 sm:p-3 text-left hover:bg-secondary/60 transition-colors group overflow-hidden"
                  onClick={() => {
                    if (sharedPassportId) {
                      setPassportOpen(true);
                      return;
                    }
                    if (a.kind === "start_milestone" && path?.nextMilestone) router.push(`/milestone/${path.nextMilestone.id}`);
                    else if (a.kind === "submit_project" && path?.nextMilestone) router.push(`/milestone/${path.nextMilestone.id}`);
                    else if (a.kind === "gate_quiz" && path?.nextMilestone) router.push(`/milestone/${path.nextMilestone.id}`);
                    else if (a.kind === "generate_path") router.push("/onboarding");
                    else router.push("/path");
                  }}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12">
                    <Icon className="h-4 w-4 text-primary" />
                  </span>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="text-sm font-medium leading-tight truncate">{a.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.detail}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Radar */}
        <Card className="glass-card min-w-0 max-w-full overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Skill radar
              <Badge variant="outline" className="ml-auto text-[10px]">{radar.goalSkillName}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SkillRadar axes={radar.axes} height={250} />
          </CardContent>
        </Card>

        {/* Momentum + top skills */}
        <Card className="glass-card min-w-0 max-w-full overflow-hidden">
          <CardHeader className="pb-2 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary shrink-0" /> Momentum
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={momentum}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--secondary)" }}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" fill="oklch(0.72 0.14 162)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 min-w-0">
              {skills.top.slice(0, 4).map((s) => (
                <div key={s.name} className="flex items-center justify-between gap-2 text-xs min-w-0">
                  <span className="truncate min-w-0 flex-1">{s.name}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="text-muted-foreground">Lvl {s.tier === "claimed" ? s.claimed : s.evidenced}/5</span>
                    <TierBadge tier={s.tier} />
                  </span>
                </div>
              ))}
              {skills.top.length === 0 && <p className="text-xs text-muted-foreground">No skill data yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Skill graph */}
      <Card className="glass-card mb-6 min-w-0 max-w-full overflow-hidden">
        <CardHeader className="pb-2 min-w-0">
          <CardTitle className="text-base flex items-center gap-2">
            <RouteIcon className="h-4 w-4 text-primary shrink-0" /> Your prerequisite DAG
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Green = proven · amber = next up · click any node for the evidence-cited why.
          </p>
        </CardHeader>
        <CardContent className="min-w-0 overflow-hidden">
          {pathSkills.length > 0 ? (
            <SkillGraph
              skills={pathSkills}
              edges={pathEdges}
              masteredSkills={masteredSkills}
              height={420}
              onNodeClick={explainSkill}
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              No active path — generate one from onboarding.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly coach + activity */}
      <div className="grid gap-4 lg:grid-cols-2 min-w-0 max-w-full">
        <Card className="glass-card min-w-0 max-w-full overflow-hidden">
          <CardHeader className="pb-2 min-w-0">
            <div className="flex items-center justify-between min-w-0 gap-2">
              <CardTitle className="text-base flex items-center gap-2 truncate min-w-0">
                <BrainCircuit className="h-4 w-4 text-primary shrink-0" /> The Coach — weekly review
              </CardTitle>
              {!sharedPassportId && (
                <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={generateWeekly}>
                  <RefreshCw className="mr-1 h-3 w-3" /> {data.weekly ? "Refresh" : "Generate"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="min-w-0 overflow-hidden">
            {data.weekly ? (
              <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed break-words [&_strong]:text-primary [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-2"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(data.weekly.content) }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No report yet. Generate one — The Coach reads your real activity metrics and tells you the truth.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card min-w-0 max-w-full overflow-hidden">
          <CardHeader className="pb-2 min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary shrink-0" /> Activity feed
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-72 overflow-y-auto thin-scroll space-y-2 min-w-0">
            {activity.length === 0 && <p className="text-sm text-muted-foreground">Quiet so far.</p>}
            {activity.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs border-b border-border/40 pb-2 last:border-0 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{ACTIVITY_LABELS[a.kind] ?? a.kind}</p>
                  <p className="text-muted-foreground truncate">
                    {typeof a.detail.skillName === "string" ? a.detail.skillName : typeof a.detail.title === "string" ? a.detail.title : ""}
                  </p>
                </div>
                <span className="text-muted-foreground shrink-0">{new Date(a.at).toLocaleDateString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Explain modal */}
      <Dialog open={explainOpen} onOpenChange={setExplainOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Why this skill?</DialogTitle>
          </DialogHeader>
          <div className="text-sm leading-relaxed text-muted-foreground">
            {explainLoading ? (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Grounding explanation in your evidence…</span>
            ) : (
              explainText
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Verifiable Skill Passport Modal */}
      <SkillPassportModal
        open={passportOpen}
        onOpenChange={setPassportOpen}
        learnerId={activeLearnerId ?? ""}
      />
    </AppShell>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, { label: string; className: string }> = {
    proven: { label: "proven", className: "border-emerald-500/50 text-emerald-300 bg-emerald-500/10" },
    verified: { label: "verified", className: "border-primary/50 text-primary bg-primary/10" },
    claimed: { label: "claimed", className: "border-amber-500/50 text-amber-300 bg-amber-500/10" },
    inferred: { label: "inferred", className: "border-border text-muted-foreground" },
    none: { label: "new", className: "border-border text-muted-foreground" },
  };
  const s = map[tier] ?? map.none;
  return <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", s.className)}>{s.label}</Badge>;
}
