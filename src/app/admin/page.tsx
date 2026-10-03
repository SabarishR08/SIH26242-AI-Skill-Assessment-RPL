"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Users, 
  ShieldCheck, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  TrendingUp, 
  Search,
  Filter,
  FileText,
  UserX,
  Lock
} from "lucide-react";

interface CandidateRecord {
  id: string;
  name: string;
  trade: string;
  state: string;
  experienceYears: number;
  theoryScore: number;
  practicalScore: number;
  overallScore: number;
  status: "CERTIFIED" | "BRIDGE_RECOMMENDED" | "FRAUD_FLAGGED";
  date: string;
}

const SAMPLE_COHORT: CandidateRecord[] = [
  { id: "RPL-101", name: "Rameshwar Patil", trade: "Automotive Service Technician (L4)", state: "Maharashtra (Pune)", experienceYears: 5, theoryScore: 84, practicalScore: 88, overallScore: 86.8, status: "CERTIFIED", date: "03-Oct-2026" },
  { id: "RPL-102", name: "Suresh Kumar", trade: "CNC Machinist & Turning (L4)", state: "Tamil Nadu (Coimbatore)", experienceYears: 4, theoryScore: 78, practicalScore: 92, overallScore: 87.8, status: "CERTIFIED", date: "03-Oct-2026" },
  { id: "RPL-103", name: "Mohammad Arif", trade: "Solar PV Project Technician (L4)", state: "Rajasthan (Jaipur)", experienceYears: 3, theoryScore: 62, practicalScore: 65, overallScore: 64.1, status: "BRIDGE_RECOMMENDED", date: "02-Oct-2026" },
  { id: "RPL-104", name: "Pooja Sharma", trade: "General Duty Assistant (L4)", state: "Uttar Pradesh (Lucknow)", experienceYears: 6, theoryScore: 90, practicalScore: 94, overallScore: 92.8, status: "CERTIFIED", date: "02-Oct-2026" },
  { id: "RPL-105", name: "Deepak Yadav", trade: "Industrial Electrician (L3)", state: "Haryana (Gurugram)", experienceYears: 2, theoryScore: 48, practicalScore: 54, overallScore: 52.2, status: "BRIDGE_RECOMMENDED", date: "01-Oct-2026" },
  { id: "RPL-106", name: "Vikas Deshmukh", trade: "Automotive Service Technician (L4)", state: "Maharashtra (Chh. Sambhajinagar)", experienceYears: 7, theoryScore: 95, practicalScore: 20, overallScore: 42.5, status: "FRAUD_FLAGGED", date: "01-Oct-2026" },
];

export default function AdminCockpitPage() {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filtered = SAMPLE_COHORT.filter(c => {
    const matchesStatus = filterStatus === "ALL" || c.status === filterStatus;
    const matchesQuery = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         c.trade.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         c.state.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Badge className="bg-orange-500/15 text-orange-300 border-orange-500/30 text-xs font-semibold px-2.5 py-0.5">
                Central Ministry Command Telemetry
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">
                MSDE • NSDC • PMKVY 4.0 RPL Execution Desk
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Building2 className="h-7 w-7 text-orange-400" /> MSDE Assessor & National Telemetry Cockpit
            </h1>
            <p className="text-sm text-muted-foreground/90 mt-1 max-w-2xl leading-relaxed">
              Real-time oversight for ministry evaluators and Sector Skill Councils (SSCs) to monitor candidate throughput, regional pass rates, and anti-fraud tamper telemetry.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-9 px-4 rounded-xl font-bold shadow-[0_0_15px_rgba(249,115,22,0.25)]">
              <Link href="/onboarding">
                Launch Candidate Assessment <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* National Metric KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card border-white/10 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-semibold text-muted-foreground">Total Candidates Assessed</span>
              <Users className="h-4 w-4 text-orange-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-white mt-2">1,248</div>
            <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +18.4% month-over-month
            </p>
          </Card>

          <Card className="glass-card border-white/10 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-semibold text-muted-foreground">Direct NSQF Certified</span>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 mt-2">892 (71.4%)</div>
            <p className="text-xs text-muted-foreground mt-1">
              Passed ≥ 70% certification threshold
            </p>
          </Card>

          <Card className="glass-card border-white/10 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-semibold text-muted-foreground">Bridge Upskilling Enrolled</span>
              <Activity className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-amber-400 mt-2">342 (27.4%)</div>
            <p className="text-xs text-muted-foreground mt-1">
              12-Hour ZPD micro-modules active
            </p>
          </Card>

          <Card className="glass-card border-white/10 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-semibold text-muted-foreground">Integrity / Fraud Intercepts</span>
              <AlertTriangle className="h-4 w-4 text-rose-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-rose-400 mt-2">14 (1.1%)</div>
            <p className="text-xs text-rose-300 mt-1">
              Voice pitch / proxy anomaly flagged
            </p>
          </Card>
        </div>

        {/* Candidate Cohort Log & Live Telemetry Table */}
        <Card className="glass-card border-white/10">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold text-white">
                  Live RPL Assessment Stream & Audit Log
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Real-time verifiable cohort results across PMKVY training centers.
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-48">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search candidate..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-orange-500"
                  />
                </div>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="CERTIFIED">Certified Only</option>
                  <option value="BRIDGE_RECOMMENDED">Bridge Recommended</option>
                  <option value="FRAUD_FLAGGED">Fraud Flagged</option>
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 px-4">Candidate ID & Name</th>
                    <th className="py-3 px-4">Job Role / Qualification Pack</th>
                    <th className="py-3 px-4">State & Center</th>
                    <th className="py-3 px-4">Score (Theory / Prac.)</th>
                    <th className="py-3 px-4">Overall</th>
                    <th className="py-3 px-4">MSDE Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{c.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{c.id} • {c.experienceYears}y exp</div>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-zinc-300">
                        {c.trade}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {c.state}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-zinc-300">
                        {c.theoryScore}% / {c.practicalScore}%
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-sm font-extrabold ${
                          c.overallScore >= 70 ? "text-emerald-400" : c.overallScore >= 50 ? "text-amber-400" : "text-rose-400"
                        }`}>
                          {c.overallScore}%
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {c.status === "CERTIFIED" && (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-bold">
                            ✓ NSQF Certified
                          </Badge>
                        )}
                        {c.status === "BRIDGE_RECOMMENDED" && (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-bold">
                            12-Hr Bridge
                          </Badge>
                        )}
                        {c.status === "FRAUD_FLAGGED" && (
                          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs font-bold flex items-center gap-1 w-fit">
                            <UserX className="h-3 w-3" /> Integrity Flag
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* National Geographic Clusters & Anti-Fraud Forensic Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* State-Wise Cluster Throughput */}
          <Card className="glass-card border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-400" /> State Industrial Cluster Throughput
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  PMKVY 4.0 RPL candidate distribution across top manufacturing hubs.
                </p>
              </div>
              <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400 font-mono">
                5 States Active
              </Badge>
            </div>

            <div className="space-y-3">
              {[
                { state: "Maharashtra (Pune - Chakan Auto Hub)", count: 412, passRate: 78.4, color: "bg-orange-500" },
                { state: "Tamil Nadu (Coimbatore - CGSC Machining)", count: 328, passRate: 84.1, color: "bg-emerald-500" },
                { state: "Uttar Pradesh (Lucknow / Kanpur Industrial)", count: 264, passRate: 71.2, color: "bg-amber-500" },
                { state: "Rajasthan (Jaipur / Solar Green Energy)", count: 142, passRate: 69.8, color: "bg-cyan-500" },
                { state: "Gujarat (Sanand / Heavy Fabrication)", count: 102, passRate: 82.3, color: "bg-purple-500" },
              ].map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-zinc-200">{item.state}</span>
                    <span className="font-mono text-muted-foreground">{item.count} candidates • {item.passRate}% pass</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full`}
                      style={{ width: `${item.passRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Real-Time Anti-Fraud & Biometric Integrity Monitor */}
          <Card className="glass-card border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" /> AI Biometric & Anti-Impersonation Log
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Automated Edge AI defenses protecting national certificate integrity.
                </p>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-mono font-bold">
                99.8% Zero Fraud Clean
              </Badge>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
                <div className="h-7 w-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <UserX className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-rose-300">Proxy Voice Detected (Intercepted)</span>
                    <span className="text-[10px] text-muted-foreground font-mono">01-Oct 14:22</span>
                  </div>
                  <p className="text-zinc-300 text-[11px] mt-0.5">
                    Candidate #RPL-106 audio stream had 2 simultaneous speakers. Oral viva automatically quarantined for human review.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-300">W3C DID Batch Cryptographically Sealed</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Today 09:00</span>
                  </div>
                  <p className="text-zinc-300 text-[11px] mt-0.5">
                    Batch #MH-2026-08 (148 certificates) signed with Ed25519 root authority and synced with Skill India Digital Hub (SIDH).
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
                <div className="h-7 w-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cyan-300">Apprenticeship Hiring Pipeline Active</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Live Sync</span>
                  </div>
                  <p className="text-zinc-300 text-[11px] mt-0.5">
                    84.3% of certified RPL candidates received automated OEM apprenticeship interviews within 14 calendar days.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
