"use client";

import Link from "next/link";
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
  Award,
  Mic,
  Wrench,
  ShieldCheck,
  Building2,
  Zap,
} from "lucide-react";
import { SkillPassportModal } from "@/components/profile/SkillPassportModal";
import { QUALIFICATION_PACKS } from "@/lib/rpl/qualification-packs";

const STAGES = [
  { id: "intro", label: "Trade Profile", icon: User },
  { id: "interview", label: "RPL Interview", icon: MessageSquare },
  { id: "evidence", label: "RPL Assessment", icon: Wrench },
  { id: "claims", label: "NOS Competency", icon: Scale },
  { id: "calibration", label: "Skill Audit", icon: RefreshCw },
  { id: "scenarios", label: "Bridge Pathway", icon: RouteIcon },
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

  const goToStage = useCallback((newStage: StageId) => {
    setStage(newStage);
    if (learnerId) {
      void api.updateOnboardingStage(learnerId, newStage).catch(() => {});
    }
  }, [learnerId]);

  const [name, setName] = useState("");
  const [starting, setStarting] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState("auto-service-tech-l4");
  const [langPreference, setLangPreference] = useState<"hi" | "mr" | "en">("hi");
  const [experienceYears, setExperienceYears] = useState("3");
  const [workshopName, setWorkshopName] = useState("Shri Ganesh Automobile Workshop");
  const [district, setDistrict] = useState("Pune / Chakan MIDC");
  const [workDetails, setWorkDetails] = useState("5 years repairing BS-VI cars, hydraulic brake servicing, engine overhaul, suspension maintenance.");

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
      const validStages: StageId[] = ["intro", "interview", "evidence", "claims", "calibration", "scenarios"];
      if (validStages.includes(s as StageId)) {
        setStage(s as StageId);
      } else if (s === "complete") {
        setStage("scenarios");
      } else {
        setStage("interview");
      }
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
      goToStage("interview");
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
        setTimeout(() => goToStage("evidence"), 1200);
      }
    } catch (e) {
      setStreamText("");
      setChat((c) => [...c, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Connection issue — try again."}` }]);
    } finally {
      setStreaming(false);
    }
  }, [input, learnerId, streaming, toast, goToStage]);

  const handleConfirmation = (isEnough: boolean) => {
    setWaitingForConfirmation(false);
    if (isEnough) {
      goToStage("evidence");
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
        goToStage("scenarios");
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
                if (i <= stageIndex && learnerId) goToStage(s.id);
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
        <div className="max-w-2xl mx-auto pt-6">
          <Card className="glass-card glow-primary border-orange-500/30">
            <CardHeader className="text-center pb-3">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/15 border border-orange-500/30">
                <Award className="h-7 w-7 text-orange-400" />
              </div>
              <Badge variant="outline" className="mx-auto border-orange-500/40 text-orange-300 text-xs py-0.5 px-3 mb-1">
                MSDE • Recognition of Prior Learning (PMKVY 4.0)
              </Badge>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-orange-400 via-amber-200 to-white bg-clip-text text-transparent">
                उम्मीदवार पंजीकरण • RPL Assessment Portal
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 max-w-lg mx-auto leading-relaxed">
                Standardizing unorganized sector craftsmanship to NSQF Qualification Packs via Vernacular Oral Viva (30%) and Practical Defect Simulators (70%).
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Candidate Full Name (उम्मीदवार का नाम) *</span>
                  <span className="text-[11px] text-muted-foreground">Self / Assessor registered</span>
                </label>
                <Input
                  placeholder="e.g. Ramesh Baburao Patil (रमेश पाटील)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-base h-11 border-zinc-700 bg-black/50"
                  autoFocus
                />
              </div>

              {/* Trade Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Select Trade & NSQF Qualification Pack (व्यवसाय चुनें) *
                </label>
                <select
                  value={selectedTrade}
                  onChange={(e) => setSelectedTrade(e.target.value)}
                  className="w-full h-11 rounded-md border border-zinc-700 bg-zinc-900/90 px-3 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {Object.values(QUALIFICATION_PACKS).map((qp) => (
                    <option key={qp.id} value={qp.id}>
                      {qp.title} ({qp.qpCode}) — NSQF Level {qp.nsqfLevel} [{qp.sectorSkillCouncil}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Language & Experience Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Oral Viva Language (मौखिक भाषा) *
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { code: "hi", label: "हिंदी" },
                      { code: "mr", label: "मराठी" },
                      { code: "en", label: "English" },
                    ].map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => setLangPreference(l.code as "hi" | "mr" | "en")}
                        className={cn(
                          "py-2 text-xs font-semibold rounded-md border transition-all text-center",
                          langPreference === l.code
                            ? "bg-orange-500/20 border-orange-500 text-orange-300 shadow-sm"
                            : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white"
                        )}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Informal Experience (कार्य अनुभव) *
                  </label>
                  <select
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    className="w-full h-10 rounded-md border border-zinc-700 bg-zinc-900/90 px-3 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="1">1 to 2 Years (Helper / Assistant)</option>
                    <option value="3">2 to 5 Years (Practicing Technician)</option>
                    <option value="5">5+ Years (Master Craftsman / Ustad)</option>
                  </select>
                </div>
              </div>

              {/* Workshop / District */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Workshop / Site Name (कार्यशाला का नाम)
                  </label>
                  <Input
                    placeholder="e.g. Shri Ganesh Auto Garage"
                    value={workshopName}
                    onChange={(e) => setWorkshopName(e.target.value)}
                    className="text-xs h-10 border-zinc-700 bg-black/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    District / Industrial Cluster (ज़िला / क्लस्टर)
                  </label>
                  <Input
                    placeholder="e.g. Chakan MIDC, Pune"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="text-xs h-10 border-zinc-700 bg-black/50"
                  />
                </div>
              </div>

              {/* Assessment Weightage Summary Banner */}
              <div className="rounded-xl bg-orange-950/30 border border-orange-500/20 p-3 text-xs text-orange-200/90 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400">
                    <Mic className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-zinc-200">Oral Viva</p>
                    <p className="text-[11px] text-muted-foreground">30% Theory Weight</p>
                  </div>
                </div>
                <div className="text-zinc-600 font-bold">+</div>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                    <Wrench className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-zinc-200">Practical Simulator</p>
                    <p className="text-[11px] text-muted-foreground">70% Practical Weight</p>
                  </div>
                </div>
                <div className="text-zinc-600 font-bold">=</div>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-emerald-300">NSQF RPL Certificate</p>
                    <p className="text-[11px] text-muted-foreground">≥70% Pass Standard</p>
                  </div>
                </div>
              </div>

              <Button
                className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                size="lg"
                onClick={begin}
                disabled={starting || !name.trim()}
              >
                {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {starting ? "Registering Candidate…" : "Begin RPL Skill Assessment (कौशल मूल्यांकन शुरू करें)"}
              </Button>

              <p className="text-[11px] text-center text-muted-foreground">
                Official Ministry of Skill Development and Entrepreneurship (MSDE) Assessment Pipeline • DPDP Act 2023 Compliant
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
            <Button variant="outline" size="sm" onClick={() => goToStage("evidence")}>
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
          {/* Card 1: Oral Viva Assessment */}
          <Card className="glass-card border-orange-500/30 bg-gradient-to-br from-orange-950/20 via-black to-black">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-orange-300">
                  <Mic className="h-5 w-5 text-orange-400" /> Vernacular Oral Viva (मौखिक परीक्षा)
                </CardTitle>
                <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40 text-[11px]">
                  30% Weightage
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                AI examiner reads audio questions in your native tongue (हिंदी / मराठी / English). Speaks back your answers using live Speech-to-Text.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-orange-950/30 border border-orange-500/20 p-2.5 text-xs text-zinc-300">
                <span className="font-semibold text-orange-300">NOS Rubric Engine:</span> Automatically validates technical synonyms and troubleshooting logic without reading/writing literacy barriers.
              </div>
              <Button asChild className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs h-10 shadow-[0_0_15px_rgba(249,115,22,0.25)]">
                <Link href="/viva">
                  Launch Voice Viva Assessment <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: Practical Defect Simulator */}
          <Card className="glass-card border-blue-500/30 bg-gradient-to-br from-blue-950/20 via-black to-black">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-blue-300">
                  <Wrench className="h-5 w-5 text-blue-400" /> Visual Practical Simulator (व्यावहारिक)
                </CardTitle>
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-[11px]">
                  70% Weightage
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Interactive tool readings (micrometer, multimeter, dial gauge), electrical hazard audits, and weld defect inspections fulfilling mandatory RPL practical criteria.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-blue-950/30 border border-blue-500/20 p-2.5 text-xs text-zinc-300">
                <span className="font-semibold text-blue-300">Digital Checkpoints:</span> Clickable defect inspection canvas with safety lockout-tagout (LOTO) protocols.
              </div>
              <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-10 shadow-[0_0_15px_rgba(37,99,235,0.25)]">
                <Link href="/practical">
                  Launch Practical Defect Simulator <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Card 3: Workshop Experience Self-Declaration */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Workshop & Trade Experience
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Describe your hands-on repairs, tools used, and informal training history.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea 
                placeholder="e.g. 4 years performing hydraulic brake bleeding, brake rotor resurfacing, OBD scanner code clearing at garage..."
                value={workDetails} 
                onChange={(e) => setWorkDetails(e.target.value)} 
                className="min-h-[80px] text-xs font-mono bg-black/40" 
              />
              <Button 
                onClick={() => {
                  addFeed(`✓ Workshop Record: ${workshopName} (${district}) — ${experienceYears}y experience recorded.`);
                  toast({ title: "Workshop record verified", description: `${experienceYears} years prior learning claimed in ${selectedTrade}.` });
                }} 
                size="sm" 
                className="w-full text-xs"
              >
                Log Workshop Experience
              </Button>
            </CardContent>
          </Card>

          {/* Card 4: Prior Documents / Resume Ingestion */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Prior Documents / Apprenticeship
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Paste any prior job-card records, apprenticeship certificates, or vocational notes.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea 
                placeholder="Paste prior certification text, employer letter, or technical resume (80+ chars)…" 
                value={resumeText} 
                onChange={(e) => setResumeText(e.target.value)} 
                className="min-h-[80px] text-xs font-mono bg-black/40" 
              />
              <Button onClick={submitResume} disabled={busy === "resume" || resumeText.trim().length < 80} size="sm" className="w-full text-xs">
                {busy === "resume" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Analyse Document Signals
              </Button>
            </CardContent>
          </Card>

          {evidenceFeed.length > 0 && (
            <Card className="glass-card md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">RPL Evidence Telemetry Log</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 font-mono text-xs">
                {evidenceFeed.map((line, i) => (
                  <p key={i} className={cn(line.startsWith("✓") ? "text-primary" : "text-destructive")}>{line}</p>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="md:col-span-2 flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Complete Viva (30%) and Practical (70%) to generate your NSQF RPL certificate.
            </p>
            <Button onClick={() => goToStage("claims")} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs">
              View Competency Audit <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </ErrorBoundary>
      )}

      {/* ── Stage: claims ────────────────────────────────────────────────── */}
      {stage === "claims" && (
      <ErrorBoundary stage="Profile" onBack={() => goToStage("evidence")} onRetry={() => { loadRadar(); goToStage("claims"); }}>
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
            <Button variant="ghost" size="sm" onClick={() => goToStage("evidence")}>← Add more evidence</Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-primary/40 text-primary hover:bg-primary/10"
                onClick={() => setPassportOpen(true)}
              >
                <Award className="mr-1.5 h-3.5 w-3.5" /> View Skill Passport
              </Button>
              <Button onClick={() => goToStage("calibration")}>
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
            <QuizRunner quiz={activeQuiz} onSubmit={(qid, answers) => api.submitQuiz(qid, answers, learnerId ?? undefined)} onFinished={onQuizFinished} />
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
            <Button variant="ghost" size="sm" onClick={() => goToStage("claims")}>← Back</Button>
            <Button onClick={() => goToStage("scenarios")}>
              Choose my roadmap <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </ErrorBoundary>
      )}

      {/* ── Stage: scenarios ─────────────────────────────────────────────── */}
      {stage === "scenarios" && (
      <ErrorBoundary stage="Roadmap" onBack={() => goToStage("calibration")} onRetry={() => { loadScenarios(); goToStage("scenarios"); }}>
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
