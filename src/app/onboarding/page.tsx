"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { QuizRunner, type QuizData, type QuizResult } from "@/components/app/QuizRunner";
import { SkillRadar } from "@/components/app/SkillRadar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useLearner } from "@/hooks/use-learner";
import { api, streamOnboardingMessage } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  Compass,
  Send,
  Github,
  Trophy,
  Swords,
  FileText,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  User,
  MessageSquare,
  Scale,
  Route as RouteIcon,
  RefreshCw,
  Zap,
  Award,
} from "lucide-react";
import { SkillPassportModal } from "@/components/profile/SkillPassportModal";

const STAGES = [
  { id: "intro", label: "Welcome", icon: User },
  { id: "interview", label: "Interview", icon: MessageSquare },
  { id: "evidence", label: "Evidence", icon: Github },
  { id: "claims", label: "Your profile", icon: Scale },
  { id: "calibration", label: "Calibration", icon: RefreshCw },
  { id: "scenarios", label: "Roadmap", icon: RouteIcon },
] as const;

type StageId = (typeof STAGES)[number]["id"];

interface ChatTurn {
  role: "assistant" | "user";
  content: string;
}

interface GapItem {
  skillId: string;
  skillName: string;
  claimedLevel: number;
  evidencedLevel: number;
  gap: number;
  tier: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { learnerId, setLearnerId, hydrated } = useLearner();
  const [stage, setStage] = useState<StageId>("intro");
  const [name, setName] = useState("");
  const [starting, setStarting] = useState(false);

  // Interview state
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [waitingForConfirmation, setWaitingForConfirmation] = useState(false);

  // Evidence state
  const [ghUser, setGhUser] = useState("");
  const [lcUser, setLcUser] = useState("");
  const [cfUser, setCfUser] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [evidenceFeed, setEvidenceFeed] = useState<string[]>([]);

  // Claims state
  const [radarAxes, setRadarAxes] = useState<Array<{ axis: string; claimed: number; evidenced: number; required: number }>>([]);
  const [tiers, setTiers] = useState<{ proven: number; verified: number; claimed: number; inferred: number }>({ proven: 0, verified: 0, claimed: 0, inferred: 0 });

  // Calibration state
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<QuizData | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [calibrated, setCalibrated] = useState<string[]>([]);

  // Scenario state
  const [previews, setPreviews] = useState<Array<{ scenario: string; label: string; tagline: string; description: string; totalSkills: number; totalHours: number; etaWeeks: number; milestones: number; algorithm: string }>>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>("balanced");
  const [passportOpen, setPassportOpen] = useState(false);
  const [hoursPerWeek, setHoursPerWeek] = useState(10);
  const [selected, setSelected] = useState("balanced");
  const [generating, setGenerating] = useState(false);
  const [goalSkillId, setGoalSkillId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; domain: string; depth: number }>>([]);
  const [searching, setSearching] = useState(false);
  const [settingGoal, setSettingGoal] = useState(false);

  // Resume an existing session.
  useEffect(() => {
    if (!hydrated || !learnerId) return;
    api.getOnboardingState(learnerId).then((state) => {
      setChat(state.history.filter((h): h is ChatTurn => h.content?.trim() != null));
      if (state.learner.name && state.learner.name !== "Learner") setName(state.learner.name);
      if (state.learner.hoursPerWeek) setHoursPerWeek(state.learner.hoursPerWeek);
      if (state.learner.goalSkillId) setGoalSkillId(state.learner.goalSkillId);
      const s = state.learner.onboardingStage;
      const target = s === "complete" ? "scenarios" : s === "evidence" ? "evidence" : "interview";
      setStage(target as StageId);
    }).catch(() => {
      /* fresh start */
    });
  }, [hydrated, learnerId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, streamText]);

  const begin = async () => {
    setStarting(true);
    try {
      const res = await api.startOnboarding(name.trim());
      setLearnerId(res.learnerId);
      setChat([{ role: "assistant", content: res.greeting }]);
      setStage("interview");
    } catch (e) {
      toast({ title: "Could not start", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const send = useCallback(async (forcedMessage?: string) => {
    const msg = forcedMessage || input; if (!msg.trim() || !learnerId || streaming) return;
    const message = msg.trim();
    setInput("");
    setChat((c) => [...c, { role: "user", content: message }]);
    setStreaming(true);
    setStreamText("");
      setActiveTools([]);
    try {
      const final = await streamOnboardingMessage(
        learnerId, 
        message, 
        (delta) => setStreamText((t) => t + delta),
        (tool) => setActiveTools((prev) => [...prev, tool]),
        (tool) => setActiveTools((prev) => prev.filter(t => t !== tool))
      );
      setStreamText("");
      setChat((c) => [...c, { role: "assistant", content: final.reply || "…" }]);
      if (final.waitingForConfirmation) {
        setWaitingForConfirmation(true);
      }
      if (final.phase === "done" || final.phase === "wrap_up") {
        setTimeout(() => setStage("evidence"), 1200);
      }
    } catch (e) {
      setStreamText("");
      setChat((c) => [...c, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Connection issue — try again."}` }]);
    } finally {
      setStreaming(false);
    }
  }, [input, learnerId, streaming, toast]);

  const handleConfirmation = (isEnough: boolean) => {
    setWaitingForConfirmation(false);
    if (isEnough) {
      setStage("evidence");
    }
  };

  const addFeed = (line: string) => setEvidenceFeed((f) => [...f, line]);

  const connectGithub = async () => {
    if (!ghUser.trim() || !learnerId) return;
    setBusy("github");
    try {
      const res = await api.connectGithub(learnerId, ghUser.trim());
      addFeed(`✓ GitHub @${res.profile.login}: ${res.profile.publicRepos} repos · ${res.analysis.claims.length} skill signals — ${res.analysis.archetype}`);
      toast({ title: "GitHub analysed", description: res.analysis.summary.slice(0, 140) });
    } catch (e) {
      addFeed(`✗ GitHub: ${e instanceof Error ? e.message : "failed"}`);
      toast({ title: "GitHub ingestion failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const connectLeetCode = async () => {
    if (!lcUser.trim() || !learnerId) return;
    setBusy("leetcode");
    try {
      const res = await api.connectLeetCode(learnerId, lcUser.trim());
      addFeed(`✓ LeetCode ${res.stats.username}: ${res.stats.total} solved (${res.stats.easy}E/${res.stats.medium}M/${res.stats.hard}H) → algorithms level ${res.stats.evidencedLevel}/5`);
    } catch (e) {
      addFeed(`✗ LeetCode: ${e instanceof Error ? e.message : "failed"}`);
      toast({ title: "LeetCode ingestion failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const connectCodeforces = async () => {
    if (!cfUser.trim() || !learnerId) return;
    setBusy("codeforces");
    try {
      const res = await api.connectCodeforces(learnerId, cfUser.trim());
      addFeed(`✓ Codeforces ${res.stats.handle}: rating ${res.stats.rating ?? "unrated"} (peak ${res.stats.maxRating ?? "—"}) → algorithms level ${res.stats.evidencedLevel}/5`);
    } catch (e) {
      addFeed(`✗ Codeforces: ${e instanceof Error ? e.message : "failed"}`);
      toast({ title: "Codeforces ingestion failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const submitResume = async () => {
    if (!resumeText.trim() || !learnerId) return;
    setBusy("resume");
    try {
      const res = await api.submitResume(learnerId, resumeText.trim());
      addFeed(`✓ Resume parsed: ${res.analysis.currentRole} · ${res.analysis.claims.length} skills detected (${res.analysis.yearsExperience}y experience)`);
    } catch (e) {
      addFeed(`✗ Resume: ${e instanceof Error ? e.message : "failed"}`);
      toast({ title: "Resume ingestion failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const loadRadar = useCallback(async () => {
    if (!learnerId) return;
    try {
      const res = await api.getRadar(learnerId);
      setRadarAxes(res.radar.axes);
      setTiers(res.tiers);
      setGaps(res.gaps);
    } catch {
      /* keep defaults */
    }
  }, [learnerId]);

  const startCalibration = async (skillId?: string) => {
    if (!learnerId) return;
    setQuizLoading(true);
    try {
      const res = await api.createCalibrationQuiz(learnerId, skillId);
      if (!res.quiz) {
        toast({ title: "Nothing to calibrate", description: res.message ?? "No gaps detected." });
        setStage("scenarios");
        return;
      }
      setActiveQuiz({
        quizId: res.quiz.quizId,
        skillName: res.quiz.skillName,
        claimedLevel: res.quiz.claimedLevel,
        mode: res.quiz.mode,
        questions: res.quiz.questions,
      });
    } catch (e) {
      toast({ title: "Quiz generation failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setQuizLoading(false);
    }
  };

  const onQuizFinished = async (result: QuizResult) => {
    if (result.passed && activeQuiz) {
      setCalibrated((c) => [...c, activeQuiz.skillName]);
    }
    await loadRadar();
  };

  const loadScenarios = useCallback(async () => {
    if (!learnerId) return;
    if (!goalSkillId) {
      setPreviews([]);
      return;
    }
    try {
      const res = await api.previewScenarios(learnerId, undefined, hoursPerWeek);
      setPreviews(res.previews);
    } catch {
      /* defaults */
    }
  }, [learnerId, goalSkillId, hoursPerWeek]);

  const searchSkills = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.searchSkills(query);
      setSearchResults(res.hits);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const selectGoalSkill = async (skillId: string) => {
    if (!learnerId) return;
    setSettingGoal(true);
    try {
      await api.changeGoalSkill(learnerId, skillId);
      setGoalSkillId(skillId);
      toast({ title: "Goal set", description: "Your learning goal has been successfully set." });
    } catch (e) {
      toast({ title: "Failed to set goal", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSettingGoal(false);
    }
  };

  const generate = async () => {
    if (!learnerId) return;
    setGenerating(true);
    try {
      await api.generatePath(learnerId, selected, undefined, hoursPerWeek);
      router.push("/dashboard");
    } catch (e) {
      toast({ title: "Generation failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
      setGenerating(false);
    }
  };

  // Load state on stage change to scenarios or mount
  useEffect(() => {
    if (!learnerId || stage !== "scenarios") return;
    api.getOnboardingState(learnerId).then((state) => {
      if (state.learner.goalSkillId) setGoalSkillId(state.learner.goalSkillId);
      if (state.learner.hoursPerWeek) setHoursPerWeek(state.learner.hoursPerWeek);
    }).catch(() => {});
  }, [stage, learnerId]);

  // Stage transitions trigger data loads.
  useEffect(() => {
    if (stage === "claims") void loadRadar();
    if (stage === "calibration") void loadRadar();
    if (stage === "scenarios") void loadScenarios();
  }, [stage, loadRadar, loadScenarios]);

  const stageIndex = STAGES.findIndex((s) => s.id === stage);

  return (
    <AppShell learnerName={name || null}>
      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 thin-scroll">
          {STAGES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                if (i <= stageIndex && learnerId) setStage(s.id);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
                i === stageIndex ? "bg-primary/15 text-primary border border-primary/40" : i < stageIndex ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/50",
              )}
            >
              {i < stageIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
              {s.label}
            </button>
          ))}
        </div>
        <Progress value={(stageIndex / (STAGES.length - 1)) * 100} className="h-1 mt-3" />
      </div>

      {/* ── Stage: intro ─────────────────────────────────────────────────── */}
      {stage === "intro" && (
      <ErrorBoundary stage="Welcome" onRetry={() => setStage("intro")}>
        <div className="max-w-xl mx-auto pt-10">
          <Card className="glass-card glow-primary">
            <CardHeader className="text-center pb-2">
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30">
                <Compass className="h-7 w-7 text-primary" />
              </span>
              <CardTitle className="text-2xl">Welcome to PathFinder</CardTitle>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Ten minutes from now you&apos;ll have a verified skill profile and a roadmap
                with every step justified. First — what should I call you?
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && begin()}
                className="text-base h-11"
                autoFocus
              />
              <Button className="w-full h-11" size="lg" onClick={begin} disabled={starting || !name.trim()}>
                {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {starting ? "Setting up…" : "Meet Nexus, your coach"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Interview → evidence → calibration → roadmap. No accounts, no passwords — your
                profile lives in this session.
              </p>
            </CardContent>
          </Card>
        </div>
      </ErrorBoundary>
      )}

      {/* ── Stage: interview ─────────────────────────────────────────────── */}
      {stage === "interview" && (
      <ErrorBoundary stage="Interview" onBack={() => setStage("intro")} onRetry={() => setStage("interview")}>
        <div className="max-w-3xl mx-auto">
          <Card className="glass-card flex flex-col" style={{ height: "min(72vh, 640px)" }}>
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" /> Nexus — onboarding interview
                </CardTitle>
                <Badge variant="secondary" className="text-xs">streaming</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto thin-scroll p-4 space-y-4">
              {chat.map((turn, i) => (
                <div key={i} className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                      turn.role === "user" ? "bg-[#3A3A3C] text-white rounded-br-md" : "bg-[#1C1C1E] text-white rounded-bl-md border border-white/5",
                    )}
                  >
                    {turn.content}
                  </div>
                </div>
              ))}
              {streaming && (
                <div className="flex flex-col justify-start gap-2">
                  {activeTools.length > 0 && (
                    <div className="flex flex-col gap-1 pl-1">
                      {activeTools.map((t, i) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" /> Nexus is using {t}...
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-[#1C1C1E] border border-white/5 text-white px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                      {streamText ? (
                        <>
                          {streamText}
                          <span className="stream-caret" />
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 py-0.5">
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </CardContent>
            <div className="border-t border-border/60 p-3 flex flex-col gap-2">
              {waitingForConfirmation && (
                <div className="flex gap-2 w-full mb-2">
                  <Button variant="outline" className="flex-1" onClick={() => handleConfirmation(false)}>Yes, I have more to add</Button>
                  <Button className="flex-1" onClick={() => handleConfirmation(true)}>No, that's enough</Button>
                </div>
              )}
              <div className="flex gap-2 w-full">
              <Input
                placeholder="Answer naturally — details help…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                disabled={streaming || waitingForConfirmation}
                autoFocus
              />
              <Button onClick={() => send()} disabled={streaming || !input.trim() || waitingForConfirmation} size="icon" className="h-10 w-10 shrink-0">
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
              </div>
            </div>
          </Card>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Nexus asks one question at a time and adapts to your answers. Type &quot;skip&quot; to move faster.
            </p>
            <Button variant="outline" size="sm" onClick={() => setStage("evidence")}>
              Skip to evidence <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </ErrorBoundary>
      )}

      {/* ── Stage: evidence ──────────────────────────────────────────────── */}
      {stage === "evidence" && (
      <ErrorBoundary stage="Evidence" onBack={() => setStage("interview")} onRetry={() => setStage("evidence")}>
        <div className="max-w-4xl mx-auto grid gap-4 md:grid-cols-2">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Github className="h-4 w-4 text-primary" /> GitHub
              </CardTitle>
              <p className="text-xs text-muted-foreground">Your repositories become skill proof — languages, READMEs, activity.</p>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Input placeholder="github username" value={ghUser} onChange={(e) => setGhUser(e.target.value)} onKeyDown={(e) => e.key === "Enter" && connectGithub()} />
              <Button onClick={connectGithub} disabled={busy === "github" || !ghUser.trim()} size="sm" className="shrink-0">
                {busy === "github" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyse"}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Resume / LinkedIn
              </CardTitle>
              <p className="text-xs text-muted-foreground">Paste your resume or LinkedIn experience — privacy-first, no OAuth.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea placeholder="Paste resume / profile text (80+ characters)…" value={resumeText} onChange={(e) => setResumeText(e.target.value)} className="min-h-[72px] text-sm" />
              <Button onClick={submitResume} disabled={busy === "resume" || resumeText.trim().length < 80} size="sm" className="w-full">
                {busy === "resume" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Analyse text
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" /> LeetCode
              </CardTitle>
              <p className="text-xs text-muted-foreground">Solved counts (weighted E/M/H) convert to an evidenced algorithm level.</p>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Input placeholder="leetcode username" value={lcUser} onChange={(e) => setLcUser(e.target.value)} onKeyDown={(e) => e.key === "Enter" && connectLeetCode()} />
              <Button onClick={connectLeetCode} disabled={busy === "leetcode" || !lcUser.trim()} size="sm" className="shrink-0">
                {busy === "leetcode" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Swords className="h-4 w-4 text-primary" /> Codeforces
              </CardTitle>
              <p className="text-xs text-muted-foreground">Contest rating bands map to algorithm and data-structure levels.</p>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Input placeholder="codeforces handle" value={cfUser} onChange={(e) => setCfUser(e.target.value)} onKeyDown={(e) => e.key === "Enter" && connectCodeforces()} />
              <Button onClick={connectCodeforces} disabled={busy === "codeforces" || !cfUser.trim()} size="sm" className="shrink-0">
                {busy === "codeforces" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
              </Button>
            </CardContent>
          </Card>

          {evidenceFeed.length > 0 && (
            <Card className="glass-card md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Ingestion log</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 font-mono text-xs">
                {evidenceFeed.map((line, i) => (
                  <p key={i} className={cn(line.startsWith("✓") ? "text-primary" : "text-destructive")}>{line}</p>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="md:col-span-2 flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">Connect what you have — every source sharpens the plan.</p>
            <Button onClick={() => setStage("claims")}>
              See my profile <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </ErrorBoundary>
      )}

      {/* ── Stage: claims ────────────────────────────────────────────────── */}
      {stage === "claims" && (
      <ErrorBoundary stage="Profile" onBack={() => setStage("evidence")} onRetry={() => { loadRadar(); setStage("claims"); }}>
        <div className="max-w-4xl mx-auto grid gap-4 md:grid-cols-2">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Claims vs evidence vs requirement</CardTitle>
              <p className="text-xs text-muted-foreground">
                Amber = what you claim · green = what your data proves · red dashes = what your goal demands.
              </p>
            </CardHeader>
            <CardContent>
              <SkillRadar axes={radarAxes} height={320} />
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Evidence tiers</CardTitle>
              <p className="text-xs text-muted-foreground">How each skill belief is backed right now.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <TierRow label="Proven" desc="Real artefacts (GitHub, contests)" count={tiers.proven} />
              <TierRow label="Verified" desc="Confirmed by quiz" count={tiers.verified} />
              <TierRow label="Claimed" desc="Self-reported only" count={tiers.claimed} />
              <TierRow label="Inferred" desc="Weak signals" count={tiers.inferred} />
              <Separator />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {gaps.length > 0
                  ? `${gaps.length} skill${gaps.length > 1 ? "s" : ""} show a big claim-evidence gap. The next step will audit ${gaps[0].skillName} with a short quiz.`
                  : "No significant claim-evidence gaps — your self-report matches your artefacts."}
              </p>
            </CardContent>
          </Card>
          <div className="md:col-span-2 flex justify-between items-center">
            <Button variant="ghost" size="sm" onClick={() => setStage("evidence")}>← Add more evidence</Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-primary/40 text-primary hover:bg-primary/10"
                onClick={() => setPassportOpen(true)}
              >
                <Award className="mr-1.5 h-3.5 w-3.5" /> View Skill Passport
              </Button>
              <Button onClick={() => setStage("calibration")}>
                {gaps.length > 0 ? "Audit my claims" : "Skip to roadmap"} <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </ErrorBoundary>
      )}

      {/* ── Stage: calibration ───────────────────────────────────────────── */}
      {stage === "calibration" && (
      <ErrorBoundary stage="Calibration" onBack={() => setStage("claims")} onRetry={() => setStage("calibration")}>
        <div className="max-w-3xl mx-auto space-y-4">
          {!activeQuiz && (
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" /> The honesty check
                </CardTitle>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Big claims with thin proof get one short quiz — pitched at the level you claimed,
                  not at a comfortable level. Pass and it&apos;s verified; miss and the plan quietly
                  adds the right refreshers. Either way, you win an honest roadmap.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {gaps.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nothing to audit — every claim is either evidenced or modest.</p>
                )}
                {gaps.map((g) => (
                  <button
                    key={g.skillId}
                    onClick={() => startCalibration(g.skillId)}
                    disabled={quizLoading}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 text-left hover:bg-secondary/60 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{g.skillName}</p>
                      <p className="text-xs text-muted-foreground">
                        claimed {g.claimedLevel}/5 · evidenced {g.evidencedLevel}/5
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0 border-amber-500/40 text-amber-400">
                      gap +{g.gap}
                    </Badge>
                  </button>
                ))}
                {quizLoading && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating quiz…
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          {activeQuiz && (
            <QuizRunner quiz={activeQuiz} onSubmit={(qid, answers) => api.submitQuiz(qid, answers)} onFinished={onQuizFinished} />
          )}
          {calibrated.length > 0 && (
            <Card className="glass-card">
              <CardContent className="text-sm">
                <span className="text-muted-foreground">Calibrated: </span>
                {calibrated.join(", ")}
              </CardContent>
            </Card>
          )}
          <div className="flex justify-between items-center">
            <Button variant="ghost" size="sm" onClick={() => setStage("claims")}>← Back</Button>
            <Button onClick={() => setStage("scenarios")}>
              Choose my roadmap <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </ErrorBoundary>
      )}

      {/* ── Stage: scenarios ─────────────────────────────────────────────── */}
      {stage === "scenarios" && (
      <ErrorBoundary stage="Roadmap" onBack={() => setStage("calibration")} onRetry={() => { loadScenarios(); setStage("scenarios"); }}>
        <div className="max-w-5xl mx-auto">
          {!goalSkillId ? (
            <Card className="glass-card max-w-xl mx-auto glow-primary">
              <CardHeader className="text-center pb-2">
                <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30">
                  <Compass className="h-7 w-7 text-primary" />
                </span>
                <CardTitle className="text-2xl">What is your learning goal?</CardTitle>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Since you skipped the onboarding interview, we need to know what skill you want to target.
                  Search our skills catalogue to set your roadmap goal (e.g. Python Programming, JavaScript, SQL, Cybersecurity).
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Search skills (e.g. Python, SQL, Linux)..."
                  value={searchQuery}
                  onChange={(e) => searchSkills(e.target.value)}
                  className="text-base h-11"
                  autoFocus
                />
                {searching && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Searching catalogue...
                  </p>
                )}
                {searchResults.length > 0 && (
                  <div className="max-h-60 overflow-y-auto border border-border/60 rounded-lg p-1 divide-y divide-border/40 thin-scroll bg-black/40">
                    {searchResults.map((hit) => (
                      <button
                        key={hit.id}
                        onClick={() => selectGoalSkill(hit.id)}
                        disabled={settingGoal}
                        className="w-full text-left p-3 hover:bg-secondary/60 transition-colors flex justify-between items-center text-sm rounded-md"
                      >
                        <div>
                          <p className="font-medium text-white">{hit.name}</p>
                          <p className="text-xs text-muted-foreground">{hit.domain}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
                {searchQuery.trim() !== "" && searchResults.length === 0 && !searching && (
                  <p className="text-xs text-center text-muted-foreground py-2">
                    No matching skills found. Try searching for general terms like &quot;python&quot; or &quot;security&quot;.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-semibold tracking-tight">Three roadmaps, one engine</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Same prerequisite DAG, different scheduling strategy. Drag the hours to see the honest cost.
                </p>
              </div>

              <Card className="glass-card mb-6">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <Zap className="h-4 w-4 text-primary shrink-0" />
                    <input
                      type="range"
                      min={2}
                      max={40}
                      value={hoursPerWeek}
                      onChange={(e) => setHoursPerWeek(parseInt(e.target.value, 10))}
                      onMouseUp={loadScenarios}
                      onTouchEnd={loadScenarios}
                      className="flex-1 accent-primary"
                    />
                    <span className="text-sm font-medium w-24 text-right">{hoursPerWeek} h/week</span>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-3">
                {previews.map((p) => (
                  <Card
                    key={p.scenario}
                    className={cn("glass-card cursor-pointer transition-all", selected === p.scenario ? "ring-2 ring-primary glow-primary" : "hover:border-primary/40")}
                    onClick={() => setSelected(p.scenario)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{p.label}</CardTitle>
                        {selected === p.scenario && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-xs text-primary">{p.tagline}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-secondary/60 p-2">
                          <p className="text-lg font-semibold">{p.etaWeeks}w</p>
                          <p className="text-[10px] text-muted-foreground">ETA</p>
                        </div>
                        <div className="rounded-lg bg-secondary/60 p-2">
                          <p className="text-lg font-semibold">{p.milestones}</p>
                          <p className="text-[10px] text-muted-foreground">phases</p>
                        </div>
                        <div className="rounded-lg bg-secondary/60 p-2">
                          <p className="text-lg font-semibold">{p.totalSkills}</p>
                          <p className="text-[10px] text-muted-foreground">skills</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono">{p.algorithm} · {p.totalHours}h total</p>
                    </CardContent>
                  </Card>
                ))}
                {previews.length === 0 && (
                  <Card className="glass-card md:col-span-3">
                    <CardContent className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Computing scenarios…
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="mt-6 flex justify-center">
                <Button size="lg" className="glow-primary" onClick={generate} disabled={generating || !previews.length}>
                  {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RouteIcon className="mr-2 h-4 w-4" />}
                  {generating ? "Building your roadmap…" : "Generate my learning path"}
                </Button>
              </div>
            </>
          )}
        </div>
      </ErrorBoundary>
      )}

      {/* Verifiable Skill Passport Modal */}
      <SkillPassportModal
        open={passportOpen}
        onOpenChange={setPassportOpen}
        learnerId={learnerId ?? ""}
      />
    </AppShell>
  );
}

function TierRow({ label, desc, count }: { label: string; desc: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <span className={cn("text-2xl font-semibold", count > 0 ? "text-primary" : "text-muted-foreground/40")}>{count}</span>
    </div>
  );
}
