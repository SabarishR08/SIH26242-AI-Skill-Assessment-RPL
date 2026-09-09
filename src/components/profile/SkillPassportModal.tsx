"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { api, type SkillPassportData } from "@/lib/client-api";
import {
  Award,
  ShieldCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  Code2,
  Sparkles,
  Fingerprint,
  Calendar,
  Share2,
  Loader2,
  Layers,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SkillPassportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  learnerId: string;
}

export function SkillPassportModal({
  open,
  onOpenChange,
  learnerId,
}: SkillPassportModalProps) {
  const { toast } = useToast();
  const [data, setData] = useState<SkillPassportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!open || !learnerId) return;

    let active = true;
    const fetchPassport = async () => {
      setLoading(true);
      try {
        const res = await api.getSkillPassport(learnerId);
        if (active) setData(res);
      } catch (err) {
        if (active) {
          toast({
            title: "Failed to load skill passport",
            description: err instanceof Error ? err.message : "Unable to retrieve credentials",
            variant: "destructive",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchPassport();
    return () => {
      active = false;
    };
  }, [open, learnerId, toast]);

  const copyJsonLd = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data.jsonLdCredential, null, 2));
    setCopiedJson(true);
    toast({ title: "Copied JSON-LD to clipboard" });
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const copyShareableLink = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/dashboard?passport=${learnerId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast({ title: "Shareable verification link copied to clipboard!" });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <DialogTitle className="text-xl">Verifiable Skill Passport</DialogTitle>
            </div>
            {data && (
              <Badge variant="outline" className="font-mono text-[10px] border-primary/50 text-primary">
                {data.summary.passportId}
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Cryptographically authenticated competency record backed by GitHub forensic commits, gate quizzes, and project evaluations.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Compiling tamper-evident credentials…</span>
          </div>
        ) : !data ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No verified skill records found for this profile yet.
          </div>
        ) : (
          <Tabs defaultValue="card" className="w-full pt-3">
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="card" className="text-xs">
                Proof Card
              </TabsTrigger>
              <TabsTrigger value="forensics" className="text-xs">
                Forensics & Evidence
              </TabsTrigger>
              <TabsTrigger value="credential" className="text-xs">
                JSON-LD (W3C)
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: VISUAL PROOF CARD */}
            <TabsContent value="card" className="space-y-4">
              <div className="relative rounded-2xl p-6 overflow-hidden border border-primary/40 bg-gradient-to-br from-card via-card/90 to-primary/10 shadow-xl backdrop-blur-md">
                {/* Holographic accent flare */}
                <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-primary/20 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full bg-violet-500/20 blur-2xl pointer-events-none" />

                <div className="relative z-10 space-y-5">
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-2xl font-bold tracking-tight text-foreground">{data.learner.name}</h3>
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                          <ShieldCheck className="mr-1 h-3 w-3" /> VERIFIED
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {data.learner.targetRole || "Full Stack Developer"} · {data.learner.domain || "Engineering"}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                        Mastery Index
                      </div>
                      <div className="text-2xl font-black text-primary font-mono">
                        {data.summary.radarScore}%
                      </div>
                    </div>
                  </div>

                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2.5 py-2 border-y border-border/40 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground">Verified Skills</div>
                      <div className="text-lg font-bold text-foreground font-mono">{data.summary.totalVerifiedSkills}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Project Audits</div>
                      <div className="text-lg font-bold text-foreground font-mono">{data.summary.evaluationsCount}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Passed Gates</div>
                      <div className="text-lg font-bold text-foreground font-mono">{data.summary.quizzesPassed}</div>
                    </div>
                  </div>

                  {/* Skills Showcase */}
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Verified Competencies
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {data.verifiedSkills.length > 0 ? (
                        data.verifiedSkills.map((s) => (
                          <Badge
                            key={s.skillId}
                            variant="secondary"
                            className={cn(
                              "text-xs py-1 px-2.5 font-medium border",
                              s.tier === "proven"
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                : "border-primary/40 bg-primary/10 text-primary"
                            )}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3 inline" />
                            {s.skillName} (Lvl {s.level})
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Initial calibration in progress.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Footer Seal */}
                  <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/30">
                    <span className="flex items-center gap-1">
                      <Fingerprint className="h-3.5 w-3.5 text-primary" /> Hash: {data.summary.integrityHash}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> Issued: {data.summary.issuedAt.slice(0, 10)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyShareableLink}
                  className="text-xs"
                >
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />
                  {copiedLink ? "Link Copied!" : "Share Recruiter Proof"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyJsonLd}
                  className="text-xs"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {copiedJson ? "JSON Copied!" : "Copy JSON-LD"}
                </Button>
              </div>
            </TabsContent>

            {/* TAB 2: EVIDENCE & FORENSICS AUDIT */}
            <TabsContent value="forensics" className="space-y-4">
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Forensics & Audit Trail
                </h4>

                {data.verifiedSkills.length > 0 ? (
                  <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {data.verifiedSkills.map((s) => (
                      <Card key={s.skillId} className="bg-secondary/20 border-border/50">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              {s.skillName}
                            </span>
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">
                              {s.tier} · Lvl {s.level}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
                            <span className="text-primary font-medium">Source: {s.source}</span>
                            <span>• Verified {s.verifiedAt.slice(0, 10)}</span>
                          </div>
                          {s.evidenceSnippet && (
                            <p className="text-[11px] text-muted-foreground/80 mt-1 italic line-clamp-2 bg-background/50 p-1.5 rounded border border-border/30">
                              &ldquo;{s.evidenceSnippet}&rdquo;
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No forensic skill claims verified yet.</p>
                )}

                {data.evaluations.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Evaluated Projects & Gate Rubrics
                    </h4>
                    {data.evaluations.map((ev, i) => (
                      <Card key={i} className="bg-secondary/20 border-border/50">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-foreground">{ev.title}</span>
                            <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px]">
                              Score: {ev.score}% · {ev.verdict}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-primary mt-1 font-mono">
                            Repo: {ev.repoUrl}
                          </div>
                          {ev.keyStrengths.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {ev.keyStrengths.map((st, j) => (
                                <span key={j} className="text-[10px] bg-background/60 px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground">
                                  ✓ {st}
                                </span>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 3: W3C JSON-LD CREDENTIAL */}
            <TabsContent value="credential" className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>W3C Standard Verifiable Credential 2.0 (Ed25519)</span>
                <Button variant="ghost" size="sm" onClick={copyJsonLd} className="h-7 text-xs">
                  <Copy className="mr-1.5 h-3 w-3" />
                  {copiedJson ? "Copied" : "Copy Raw"}
                </Button>
              </div>
              <pre className="text-[11px] font-mono bg-secondary/30 p-4 rounded-xl border border-border/60 overflow-x-auto max-h-[340px] text-foreground/90 leading-relaxed thin-scroll">
                {JSON.stringify(data.jsonLdCredential, null, 2)}
              </pre>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
