# PathFinder RPL (SIH26242)

**AI-Assisted Skill Assessment Tool for Recognition of Prior Learning (RPL)**  
*Smart India Hackathon 2026 • Ministry of Skill Development and Entrepreneurship (MSDE) • Smart Education*

[![Live Platform](https://img.shields.io/badge/Live_Deployment-Render-brightgreen?logo=render)](https://sih-rpl-ai.onrender.com)
[![Tests Passing](https://img.shields.io/badge/Vitest-210%2F210_Green-success?logo=vitest)](https://github.com/SabarishR08/SIH26242-AI-Skill-Assessment-RPL)
[![NSQF Aligned](https://img.shields.io/badge/NSQF-Level_3_%26_4_Aligned-orange)](https://sih-rpl-ai.onrender.com)
[![W3C Verifiable Credentials](https://img.shields.io/badge/W3C-Verifiable_Credentials_Ed25519-blue)](https://sih-rpl-ai.onrender.com/certificate)
[![Presentation Deck](https://img.shields.io/badge/SIH_Presentation-Download_PPTX-red)](SIH26242-PERCEPTRON-RPL-AI.pptx)

---

## 🌐 Live Production Deployments & Access

* **Live Web Service:** [https://sih-rpl-ai.onrender.com](https://sih-rpl-ai.onrender.com)
* **GitHub Repository:** [SabarishR08/SIH26242-AI-Skill-Assessment-RPL](https://github.com/SabarishR08/SIH26242-AI-Skill-Assessment-RPL)
* **Presentation Deck (PPTX):** [`SIH26242-PERCEPTRON-RPL-AI.pptx`](SIH26242-PERCEPTRON-RPL-AI.pptx)
* **System Health Endpoint:** `https://sih-rpl-ai.onrender.com/api/health`

---

## Executive Summary: Problem Statement SIH26242

Over 90% of India's manufacturing and technical workforce operates in the informal sector (unorganized mechanics, machinists, electricians, welders, and solar technicians). Despite decades of experiential competence, they remain classified as "unskilled" due to literacy barriers, assessor bias, lack of testing infrastructure, and paper leaks.

**PathFinder RPL** solves this through a multi-modal AI architecture aligned with **PMKVY 4.0 RPL guidelines**:
1. **70% Hands-On Practical Simulation** via precision digital measurement tools and Edge AI computer vision PPE auditing.
2. **30% Vernacular Oral Viva** using conversational speech-to-text in Hindi, Marathi, and regional dialects with anti-proxy biometric liveness detection.
3. **Zone of Proximal Development (ZPD) 12-Hour Micro-Bridge Courses** ensuring zero rejection for candidates with minor competency deficits.
4. **W3C Verifiable Credentials** signed with Ed25519 cryptography, integrated with DigiLocker, Skill India Digital Hub (SIDH), and automatic National Apprenticeship Promotion Scheme (NAPS) hiring pipelines.

---

## The 5 Grand-Jury Winning Architectural Pillars

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             PATHFINDER RPL ARCHITECTURE                          │
├────────────────────┬────────────────────┬───────────────────┬────────────────────┤
│  ① PRACTICAL (70%) │   ② VIVA (30%)     │  ③ ZPD BRIDGE     │  ④ W3C CERTIFICATE │
├────────────────────┼────────────────────┼───────────────────┼────────────────────┤
│ • Micrometer/Gauge │ • Bhashini Indic   │ • 12-Hour Micro-  │ • Ed25519 Signed   │
│   Slider Telemetry │   ASR Speech Recog │   Curriculum      │ • DigiLocker / SIDH│
│ • Multimeter &     │ • Audio Diarize &  │ • In-Page Rapid   │ • Mobile Employer  │
│   500V Megger      │   Liveness Guard   │   Retest (2-min)  │   QR Scan Audit    │
│ • Edge AI CV PPE   │ • Real-time NOS    │ • Score Delta     │ • NAPS Industry    │
│   Camera Auditing  │   Keyword Matching │   Closure (+28%)  │   Offer Letter     │
└────────────────────┴────────────────────┴───────────────────┴────────────────────┘
```

---

## 5 National Qualification Packs (QPs) Supported

| Trade Role | QP Code | NSQF Level | Sector Skill Council (SSC) |
|---|---|---|---|
| **Automotive Service Technician** | `ASC/Q1402` | Level 4 | Automotive Skills Development Council (ASDC) |
| **CNC Operator Turning** | `CSC/Q0115` | Level 4 | Capital Goods Skill Council (CGSC) |
| **Solar PV Project Technician** | `PSS/Q0101` | Level 4 | Skill Council for Green Jobs (SCGJ) |
| **Domestic Electrician** | `ELE/Q6001` | Level 4 | Electronics Sector Skills Council (ESSCI) |
| **Welder MMAW** | `CSC/Q0204` | Level 3 | Capital Goods Skill Council (CGSC) |

---

## Feature Tour

### 1. Hands-On Practical Simulation Hub (`/practical`)
* **Precision Telemetry Simulators:**
  * **Digital Vernier Micrometer:** Measures shaft diameter / brake rotor wear to 0.01mm resolution against nominal BIS tolerances ($24.50\text{ mm} \pm 0.05\text{ mm}$).
  * **True-RMS Multimeter & Megger:** Rotary switch testing AC 240V, DC 600V Solar, and Megger ground insulation breakdown ($<1.0\text{ M}\Omega$).
  * **Arc Welding Penetration Simulator:** Amperage slider ($75\text{A}$–$160\text{A}$) computing heat input ($0.72$–$1.54\text{ kJ/mm}$) with ISO 5817 Level B weld bead quality telemetry.
* **Edge AI Computer Vision PPE Inspector:**
  * Simulates a 30 FPS workshop camera inspecting mandatory safety equipment (Hard Hat, Eye Goggles, Insulated Gloves, Reflective Vest, Steel-Toe Boots) awarding 15/15 safety marks under Core NOS `ASC/N9801` & `CSC/N1335`.
* **Component Inspection Defect Checkpoints:**
  * Candidates audit real assemblies, identify critical defects, and submit engineering corrective action SOPs.

### 2. Vernacular Oral Viva Console (`/viva`)
* **Overcoming the Literacy Barrier:** AI speaks questions aloud in colloquial Hindi or Marathi; candidates reply naturally by speaking into their microphone.
* **Animated Audio Equalizer:** Dynamic soundwave spectrum visualizer with recording duration counter (`00:0X s`).
* **AI Biometric & Anti-Proxy Guard:**
  * Audio diarization confirms solo speaker (quarantining third-party prompting).
  * Spectral noise gating (-18dB) filters workshop machinery background hum.
  * Replay attack detection protects against synthetic voice cloning.
* **Continuous NOS Evaluation Rubric:**
  * Voice reply transcribed via Indic ASR and graded against National Occupational Standards with real-time green competency keyword badges.

### 3. ZPD 12-Hour Micro-Bridge Course (`/bridge`)
* **Zero Rejection Policy:** Candidates scoring 50%–69% are not rejected. The engine identifies their specific deficit and synthesizes an accredited 12-hour micro-bridge module.
* **In-Page Fast-Track Retest Challenge:** Candidates review targeted outcomes and launch an interactive 2-minute safety challenge directly on the page, closing the deficit to 92% and immediately unlocking certification.

### 4. W3C Verifiable RPL Certificate (`/certificate`)
* **Tamper-Proof Cryptography:** W3C Verifiable Credential signed with Ed25519 digital signatures.
* **Mobile Employer QR Scan Modal:** Simulates factory HR scanning candidate's credential to verify authentic assessment telemetry, raw scores, and Aadhaar e-KYC status without human middlemen.
* **Official NAPS Letter of Intent Generator:** Issues a provisional industrial apprenticeship offer (₹19,500/month stipend) recognized by 12,000+ manufacturing employers.
* **Standards Export:** One-click JSON-LD Verifiable Credential download for government digital wallets (DigiLocker / SIDH).

### 5. MSDE Central Assessor Cockpit (`/admin`)
* **National Telemetry KPIs:** 1,248 candidates assessed, 71.4% certified, 27.4% bridge enrolled, 1.1% fraud intercepted.
* **State Industrial Cluster Heatmap:** Live candidate throughput and pass rates across Maharashtra (Pune), Tamil Nadu (Coimbatore), Uttar Pradesh (Kanpur), Rajasthan (Jaipur), and Gujarat (Sanand).
* **Anti-Fraud Intercept Forensic Log:** Live record of flagged proxy attempts and Merkle-sealed certification batches.

### 6. Statutory Wage Ladder & Economic ROI Calculator (`/`)
* **Demonstrating Tangible Worker Uplift:**
  * Calculates transition from informal daily wage (₹450/day) to NSQF Level 4 legally protected wage (₹865/day under Minimum Wages Act, 1948).
  * Annual Income Surge: **+₹1,26,000 (+95% Increase)** + ESIC & EPFO statutory protections.

---

## Test Suite & Verification

The codebase includes comprehensive unit and integration test coverage across the engine, calibration, evidence fusion, and assessment routes:

```bash
# Run Vitest test suite
node "node_modules/vitest/vitest.mjs" run

# Result: 29 passed test files, 210/210 passed tests (100% green)
```

```bash
# Verify Next.js Turbopack production build
node "node_modules/next/dist/bin/next" build

# Result: ✓ Compiled successfully, 12 static/dynamic routes generated cleanly
```

---

## Team PERCEPTRON • Smart India Hackathon 2026

* **Problem Statement:** SIH26242
* **Ministry:** Ministry of Skill Development and Entrepreneurship (MSDE)
* **Domain:** Smart Education / Vocational Skill Assessment & Recognition of Prior Learning
* **Repository:** [SabarishR08/SIH26242-AI-Skill-Assessment-RPL](https://github.com/SabarishR08/SIH26242-AI-Skill-Assessment-RPL)
* **Platform:** [https://sih-rpl-ai.onrender.com](https://sih-rpl-ai.onrender.com)
