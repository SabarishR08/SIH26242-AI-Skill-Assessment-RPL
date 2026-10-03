"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ShieldCheck, 
  Award, 
  QrCode, 
  Download, 
  CheckCircle2, 
  ExternalLink, 
  Lock, 
  Sparkles,
  Building2,
  Calendar,
  Check,
  UserCheck
} from "lucide-react";
import { QUALIFICATION_PACKS, QualificationPack } from "@/lib/rpl/qualification-packs";

export default function CertificatePage() {
  const [selectedQpId, setSelectedQpId] = useState<string>("auto-service-tech-l4");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationSuccess, setVerificationSuccess] = useState<boolean>(false);
  const [showJsonLdModal, setShowJsonLdModal] = useState<boolean>(false);

  const qp: QualificationPack = QUALIFICATION_PACKS[selectedQpId] || QUALIFICATION_PACKS["auto-service-tech-l4"];

  const handleSimulateVerification = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setVerificationSuccess(true);
    }, 700);
  };

  const downloadJsonLd = () => {
    const vcPayload = {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://schema.org"
      ],
      "id": `urn:uuid:rpl-${qp.qpCode.toLowerCase().replace(/[^a-z0-9]/g, "-")}-2026`,
      "type": ["VerifiableCredential", "NSQFSKillCertificate"],
      "issuer": "did:web:msde.gov.in:rpl-authority",
      "issuanceDate": new Date().toISOString(),
      "credentialSubject": {
        "id": "did:aadhaar:sha256-4819",
        "name": "Sabarish R.",
        "qualificationPack": qp.title,
        "qpCode": qp.qpCode,
        "nsqfLevel": qp.nsqfLevel,
        "sectorSkillCouncil": qp.sectorSkillCouncil,
        "practicalScore": "88%",
        "oralVivaScore": "82%",
        "assessmentStatus": "COMPETENT"
      },
      "proof": {
        "type": "Ed25519Signature2020",
        "created": new Date().toISOString(),
        "verificationMethod": "did:web:msde.gov.in#key-1",
        "proofPurpose": "assertionMethod",
        "jws": "eyJhbGciOiJFZERTQSI...z841f"
      }
    };

    const blob = new Blob([JSON.stringify(vcPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rpl-certificate-${qp.qpCode.replace("/", "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs font-semibold px-2.5 py-0.5">
                W3C Verifiable Credentials Standard (Ed25519 Signed)
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">
                DigiLocker & Skill India Digital Hub (SIDH) Integrated
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <ShieldCheck className="h-7 w-7 text-emerald-400" /> डिजिटल आरपीएल कौशल्य प्रमाणपत्र (Verifiable Digital RPL Certificate)
            </h1>
            <p className="text-sm text-muted-foreground/90 mt-1 max-w-2xl leading-relaxed">
              Instant, tamper-proof cryptographic certification for experiential informal workers. Factory HRs and contractors scan the embedded QR code to verify raw competency scores without human middlemen.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={downloadJsonLd}
              className="border-white/10 text-zinc-300 hover:text-white text-xs font-medium h-9 px-3 rounded-xl"
            >
              Export JSON-LD VC
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="bg-white text-black hover:bg-white/90 text-xs font-bold h-9 px-4 rounded-xl"
            >
              <Download className="mr-1.5 h-4 w-4" /> Download PDF Certificate
            </Button>
          </div>
        </div>

        {/* Trade Selection Tabs - Responsive 5-column grid */}
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Select Certified Trade Credential (5 National QPs):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {Object.values(QUALIFICATION_PACKS).map((pack) => {
              const isSelected = pack.id === selectedQpId;
              return (
                <button
                  key={pack.id}
                  onClick={() => {
                    setSelectedQpId(pack.id);
                    setVerificationSuccess(false);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? "bg-emerald-500/15 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/15"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-emerald-400 font-bold">{pack.qpCode}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/10 text-zinc-300">
                      L{pack.nsqfLevel}
                    </Badge>
                  </div>
                  <div className="text-xs font-bold text-white mt-1.5 line-clamp-1">{pack.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{pack.titleHindi}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Certificate Display Container */}
        <div className="max-w-4xl mx-auto">
          <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-b from-zinc-900 via-black to-zinc-950 border-2 border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.1)] relative overflow-hidden">
            {/* Ambient Watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            
            {/* Certificate Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/10 pb-6 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <Award className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-orange-400">
                    Government of India • MSDE
                  </h3>
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                    National Skill Development Corporation
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    Recognition of Prior Learning (RPL) Official Credential
                  </p>
                </div>
              </div>

              <div className="text-center sm:text-right">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-bold px-3 py-1">
                  ✓ NSQF Level {qp.nsqfLevel} Certified
                </Badge>
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  Credential ID: RPL-2026-{qp.qpCode.replace("/", "")}-9421
                </div>
              </div>
            </div>

            {/* Candidate Body */}
            <div className="py-8 space-y-6 text-center sm:text-left">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  This is to certify that
                </p>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-1">
                  Sabarish R.
                </h1>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  Aadhaar Virtual ID: XXXX-XXXX-4819 • Experiential Prior Learning: 4+ Years
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                <p className="text-sm text-zinc-200 leading-relaxed">
                  Has successfully demonstrated competent mastery under the <strong>National Skills Qualification Framework (NSQF Level {qp.nsqfLevel})</strong> for the job role of:
                </p>
                <div className="text-xl font-black text-orange-400 mt-1">
                  {qp.title} ({qp.qpCode})
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Sector Council: {qp.sectorSkillCouncil}
                </div>
              </div>

              {/* NOS Competency Mastery Matrix */}
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2.5">
                  Assessed National Occupational Standards (NOS) Competency Scores:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {qp.nosUnits.map((nos) => (
                    <div key={nos.code} className="p-3 rounded-xl bg-black/60 border border-white/5 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-mono text-emerald-400 font-bold">{nos.code}</div>
                        <div className="text-xs text-zinc-300 font-medium truncate max-w-[240px]">{nos.title}</div>
                      </div>
                      <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-xs">
                        94% Passed
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Certificate Footer with QR Code & Crypto Signature */}
            <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                {/* QR Code Container */}
                <div className="p-2.5 rounded-xl bg-white text-black flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <QrCode className="h-16 w-16" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-emerald-400" /> Ed25519 Cryptographic Proof
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-0.5 max-w-[200px] truncate">
                    sig: 0x9f8c...3b4e72a8d11c05
                  </div>
                  <button
                    onClick={handleSimulateVerification}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:underline mt-1 block"
                  >
                    {isVerifying ? "Verifying On-Chain..." : "Simulate Employer QR Scan →"}
                  </button>
                </div>
              </div>

              <div className="text-center sm:text-right space-y-1">
                <div className="text-xs text-muted-foreground font-mono">Date of Issuance: 03-Oct-2026</div>
                <div className="text-xs text-zinc-400">Authorized Signatory: MSDE / NSDC Assessment Body</div>
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs py-0.5 px-2">
                  <Check className="mr-1 h-3 w-3" /> DigiLocker Verified Status
                </Badge>
              </div>
            </div>

            {/* Simulated Live Employer Verification Modal */}
            {verificationSuccess && (
              <div className="mt-6 p-5 rounded-2xl bg-zinc-950/90 border border-emerald-500/40 space-y-4 animate-in fade-in duration-300 shadow-[0_0_25px_rgba(16,185,129,0.15)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        Employer Verification Passed (Live SIDH Registry)
                      </h4>
                      <p className="text-xs text-emerald-300">
                        Ed25519 cryptographic signature authentic. Zero certificate forgery risk.
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500 text-black font-extrabold text-xs px-3 py-1">
                    ✓ 100% AUTHENTIC
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-muted-foreground block text-[11px]">Candidate Identity:</span>
                    <span className="font-bold text-white">Sabarish R.</span>
                    <span className="text-emerald-400 block font-mono text-[10px]">Aadhaar e-KYC Verified</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-muted-foreground block text-[11px]">Assessment Breakdown:</span>
                    <span className="font-bold text-white">Hands-On 88% • Viva 82%</span>
                    <span className="text-cyan-400 block font-mono text-[10px]">Overall: 86.2% Competent</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-muted-foreground block text-[11px]">Employer Placement Action:</span>
                    <span className="font-bold text-orange-400">Ready for Factory Hiring</span>
                    <span className="text-zinc-400 block text-[10px]">Minimum Wage Upgrade Eligible</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-[11px] font-mono text-zinc-400">
                    DID Issuer: did:web:msde.gov.in • Block Timestamp: {new Date().toLocaleTimeString()}
                  </span>
                  <Button
                    size="sm"
                    className="bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold h-8 px-4 rounded-xl shadow-md"
                    onClick={() => alert("Candidate Sabarish R. marked for prioritized factory placement in MSDE Apprenticeship Portal!")}
                  >
                    🤝 Issue Direct Apprenticeship Offer
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
