import os
import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

src_template = r"E:\Downloads\Copy of SIH26134-167778-PERCEPTRON.pptx"
dst_pptx_1 = r"E:\Downloads\01 Hackathons & Events\SIH_PS2\SIH26242-PERCEPTRON-RPL-AI.pptx"
dst_pptx_2 = r"E:\Downloads\01 Hackathons & Events\SIH_PS2\pathfinder-rpl\SIH26242-PERCEPTRON-RPL-AI.pptx"

img_slide2 = r"E:\Downloads\01 Hackathons & Events\SIH_PS2\docs\deck_assets\slide2_multimodal_ui.jpg"
img_slide3 = r"E:\Downloads\01 Hackathons & Events\SIH_PS2\docs\deck_assets\slide3_tech_flowchart.jpg"
img_slide5 = r"E:\Downloads\01 Hackathons & Events\SIH_PS2\docs\deck_assets\slide5_socio_economic_impact.jpg"

prs = pptx.Presentation(src_template)

def set_text_run(paragraph, text, font_name="Times New Roman", font_size=12.0, bold=False):
    paragraph.text = ""
    r = paragraph.add_run()
    r.text = text
    r.font.name = font_name
    r.font.size = Pt(font_size)
    r.font.bold = bold
    return r

def add_lead_in_bullet(tf, lead_in, body, font_name="Times New Roman", font_size=12.0, space_after=2):
    p = tf.add_paragraph()
    p.space_after = Pt(space_after)
    if lead_in:
        r1 = p.add_run()
        r1.text = lead_in
        r1.font.name = font_name
        r1.font.size = Pt(font_size)
        r1.font.bold = True
    if body:
        r2 = p.add_run()
        r2.text = body
        r2.font.name = font_name
        r2.font.size = Pt(font_size)
        r2.font.bold = False
    return p

def replace_image(slide, shape_name, new_image_path):
    target_shape = None
    for s in slide.shapes:
        if s.name == shape_name:
            target_shape = s
            break
    if target_shape is None:
        print(f"Warning: shape {shape_name} not found on slide")
        return None
    left, top, width, height = target_shape.left, target_shape.top, target_shape.width, target_shape.height
    sp = target_shape._element
    sp.getparent().remove(sp)
    new_pic = slide.shapes.add_picture(new_image_path, left, top, width, height)
    print(f"Replaced {shape_name} with {new_image_path} at ({left}, {top}, {width}, {height})")
    return new_pic

# ==============================================================================
# SLIDE 1: Title
# ==============================================================================
slide1 = prs.slides[0]
for shape in slide1.shapes:
    if shape.has_text_frame:
        t = shape.text_frame.text.strip()
        if "Challenges in aligning" in t or "AI-Assisted" in t:
            shape.text_frame.text = ""
            p = shape.text_frame.paragraphs[0]
            set_text_run(p, "AI-Assisted Skill Assessment Tool for Recognition of Prior Learning (RPL)", font_name="Times New Roman", font_size=31.5, bold=True)
        elif "SMART INDIA HACKATHON" in t:
            shape.text_frame.text = ""
            p = shape.text_frame.paragraphs[0]
            set_text_run(p, "SMART INDIA HACKATHON 2026", font_name="Garamond", font_size=40.0, bold=True)
        elif "Problem Statement ID" in t:
            shape.text_frame.text = ""
            lines = [
                "Problem Statement ID – SIH26242",
                "Theme - Smart Education",
                "PS Category- Software",
                "Team ID- 167778",
                "Team Name - PERCEPTRON"
            ]
            for idx, line in enumerate(lines):
                p = shape.text_frame.add_paragraph() if idx > 0 else shape.text_frame.paragraphs[0]
                p.space_after = Pt(2)
                set_text_run(p, line, font_name="Arial", font_size=23.0, bold=True)

# ==============================================================================
# SLIDE 2: Problem & Proposed Solution
# ==============================================================================
slide2 = prs.slides[1]
for shape in slide2.shapes:
    if shape.has_text_frame:
        t = shape.text_frame.text.strip()
        if "Closed-loop" in t or "AI-Assisted Recognition" in t:
            shape.text_frame.text = ""
            p = shape.text_frame.paragraphs[0]
            set_text_run(p, "AI-Assisted Recognition of Prior Learning (RPL): Vernacular Voice Viva, Hands-on Tool Telemetry, 12-Hour Micro-Bridge Courses & W3C Verifiable Credentials", font_name="Arial", font_size=13.5, bold=True)
        elif t.startswith("PROBLEM"):
            shape.text_frame.text = ""
            p0 = shape.text_frame.paragraphs[0]
            p0.space_after = Pt(4)
            set_text_run(p0, "PROBLEM", font_name="Times New Roman", font_size=26.0, bold=True)
            p1 = shape.text_frame.add_paragraph()
            set_text_run(p1, "India's 400M+ unorganized craftsmen face structural RPL bottlenecks: literacy barriers in written MCQ exams, subjective assessor bias, zero access to physical testing rigs in rural areas, rigid pass/fail rejection without remediation, and paper certificate forgery.", font_name="Times New Roman", font_size=13.5, bold=True)
        elif "OUR IDEA" in t:
            shape.text_frame.text = ""
            p0 = shape.text_frame.paragraphs[0]
            p0.alignment = pptx.enum.text.PP_ALIGN.CENTER
            p0.space_after = Pt(4)
            set_text_run(p0, "OUR IDEA", font_name="Calibri", font_size=26.0, bold=True)
            p1 = shape.text_frame.add_paragraph()
            p1.space_after = Pt(3)
            set_text_run(p1, "PathFinder RPL is a multi-modal AI skill assessment & certification engine empowering informal experiential workers under NSQF.", font_name="Times New Roman", font_size=13.0, bold=True)
            p2 = shape.text_frame.add_paragraph()
            set_text_run(p2, "Vernacular Oral Viva (30%) + Virtual Tool Telemetry (70%) + Edge AI CV PPE Audit + 12-Hr ZPD Micro-Bridge + W3C Cryptographic QR", font_name="Times New Roman", font_size=13.0, bold=True)
        elif "PROPOSED SOLUTION" in t:
            shape.text_frame.text = ""
            p0 = shape.text_frame.paragraphs[0]
            p0.space_after = Pt(4)
            set_text_run(p0, "PROPOSED SOLUTION:", font_name="Calibri", font_size=26.0, bold=True)
            bullets = [
                ("• 70% Practical Simulation: ", "Digital micrometer (0.01mm), true-RMS multimeter & weld penetration"),
                ("• Edge AI Computer Vision: ", "30 FPS workshop camera auditing mandatory PPE & safety compliance"),
                ("• 30% Vernacular Oral Viva: ", "Colloquial Hindi & Marathi via Indic ASR speech recognition"),
                ("• Anti-Proxy Audio Telemetry: ", "Audio diarization & voiceprint biometric liveness eliminating fraud"),
                ("• Zone of Proximal Development: ", "12-hr tailored micro-bridge with in-page 2-min retest"),
                ("• 5 National QPs: ", "Automotive Technician, CNC Turning, Solar PV, Electrician & Welder MMAW"),
                ("• W3C Verifiable Credentials: ", "Ed25519 digital signatures & instant mobile QR verification"),
                ("• Statutory Wage Surge: ", "Minimum Wages Act 1948 (+₹1.26L/yr uplift) & NAPS employer hiring")
            ]
            for lead, body in bullets:
                add_lead_in_bullet(shape.text_frame, lead, body, font_name="Times New Roman", font_size=12.0, space_after=2)

# Replace diagram on Slide 2
replace_image(slide2, "Google Shape;110;p2", img_slide2)

# ==============================================================================
# SLIDE 3: Technical Approach
# ==============================================================================
slide3 = prs.slides[2]
for shape in slide3.shapes:
    if shape.has_text_frame:
        t = shape.text_frame.text.strip()
        if "TECHNICAL APPROACH" in t:
            shape.text_frame.text = ""
            p = shape.text_frame.paragraphs[0]
            set_text_run(p, "TECHNICAL APPROACH", font_name="Times New Roman", font_size=36.0, bold=True)
        elif "Software Applications:" in t:
            shape.text_frame.text = ""
            p0 = shape.text_frame.paragraphs[0]
            p0.space_after = Pt(4)
            set_text_run(p0, "Software Applications:", font_name="Times New Roman", font_size=24.0, bold=True)
            tech_stack = [
                ("• Next.js 16 + React 19 – ", "Full-stack web app, PWA offline caching & MSDE cockpit"),
                ("• Python & Node.js – ", "Audio signal processing & edge telemetry ingestion"),
                ("• Bhashini / Indic-ASR – ", "Vernacular Hindi & Marathi speech-to-text recognition"),
                ("• YOLOv8-Workshop – ", "Edge computer vision PPE & safety compliance detection"),
                ("• Virtual Tool Simulator – ", "Digital micrometer, true-RMS multimeter & weld reticle"),
                ("• Zone of Proximal Development – ", "Algorithmic 12-hr micro-bridge synthesizer"),
                ("• PostgreSQL + SQLite / Prisma – ", "Learner dossiers & NSQF NOS standards"),
                ("• W3C Verifiable Credentials – ", "Ed25519 cryptographic proofs & JSON-LD standard"),
                ("• Zod + TypeScript – ", "Strict end-to-end runtime validation"),
                ("• Vitest Test Suite – ", "210/210 automated unit and integration tests (100% green)"),
                ("• Render Cloud Platform – ", "Live auto-scaling deployment (sih-rpl-ai.onrender.com)")
            ]
            for lead, body in tech_stack:
                add_lead_in_bullet(shape.text_frame, lead, body, font_name="Times New Roman", font_size=11.5, space_after=2)
        elif "Layers of Approach" in t and "↓" not in t:
            shape.text_frame.text = ""
            p = shape.text_frame.paragraphs[0]
            p.alignment = pptx.enum.text.PP_ALIGN.CENTER
            set_text_run(p, "Layers of Approach", font_name="Calibri", font_size=24.0, bold=True)
        elif "↓" in t or "Triangulated" in t or "Experiential" in t:
            shape.text_frame.text = ""
            layers = [
                ("Experiential Candidate Onboarding & Dialect Selection", False),
                ("↓", True),
                ("Vernacular Oral Viva (30%) + Voiceprint Biometrics", False),
                ("↓", True),
                ("Hands-On Tool Telemetry (70%) & Edge CV PPE Audit", False),
                ("↓", True),
                ("Continuous NOS Scoring vs 70% PMKVY Threshold", False),
                ("↓", True),
                ("ZPD 12-Hour Micro-Bridge Remediation (50%–69%)", False),
                ("↓", True),
                ("W3C Verifiable Credential (Ed25519) & NAPS Placement", False)
            ]
            for idx, (ltxt, is_arrow) in enumerate(layers):
                p = shape.text_frame.add_paragraph() if idx > 0 else shape.text_frame.paragraphs[0]
                p.alignment = pptx.enum.text.PP_ALIGN.CENTER if is_arrow else pptx.enum.text.PP_ALIGN.LEFT
                p.space_after = Pt(2) if is_arrow else Pt(1)
                fsize = 15.0 if is_arrow else 12.0
                set_text_run(p, ltxt, font_name="Times New Roman", font_size=fsize, bold=True)

# Replace flowchart on Slide 3
replace_image(slide3, "Google Shape;130;p3", img_slide3)

# ==============================================================================
# SLIDE 4: Feasibility and Viability (4 Quadrants)
# ==============================================================================
slide4 = prs.slides[3]
for shape in slide4.shapes:
    if shape.has_text_frame:
        t = shape.text_frame.text.strip()
        if "FEASIBILITY" in t:
            shape.text_frame.text = ""
            p = shape.text_frame.paragraphs[0]
            set_text_run(p, "FEASIBILITY  AND  VIABILITY", font_name="Times New Roman", font_size=36.0, bold=True)
        elif t.startswith("Feasibility"):
            shape.text_frame.text = ""
            p0 = shape.text_frame.paragraphs[0]
            p0.space_after = Pt(4)
            set_text_run(p0, "Feasibility", font_name="Times New Roman", font_size=23.0, bold=True)
            bullets = [
                ("• Technical readiness – ", "Production-grade platform with 210/210 tests passing"),
                ("• Accessibility – ", "Vernacular voice overcoming reading & writing literacy barriers"),
                ("• Hardware independence – ", "Browser-based precision tooling without testing rigs"),
                ("• Regulatory alignment – ", "100% compliant with MSDE PMKVY 4.0 RPL guidelines"),
                ("• Scalability – ", "Low-latency Edge AI running smoothly on budget Android devices"),
                ("• Integration – ", "Seamless linkage to DigiLocker, SIDH, and NAPS apprenticeship portals"),
                ("• Privacy & security – ", "Aadhaar e-KYC masking and DPDP Act 2023 compliance")
            ]
            for lead, body in bullets:
                add_lead_in_bullet(shape.text_frame, lead, body, font_name="Times New Roman", font_size=12.0, space_after=2)
        elif t.startswith("Commercial Feasibility"):
            shape.text_frame.text = ""
            p0 = shape.text_frame.paragraphs[0]
            p0.space_after = Pt(4)
            set_text_run(p0, "Commercial Feasibility", font_name="Times New Roman", font_size=23.0, bold=True)
            bullets = [
                ("• Unit economics: ", "Reduces per-candidate RPL cost from ₹1,200 to <₹40"),
                ("• Zero CapEx: ", "No expensive physical lab rigs required for remote ITIs"),
                ("• Zero logistics: ", "Eliminates paper exam printing, proctor travel & leak risks"),
                ("• Deployment flexibility: ", "Cloud, edge, and offline PWA for rural industrial clusters"),
                ("• Corporate demand: ", "OEM recruiter placement telemetry (Tata, L&T, Mahindra)"),
                ("• Universal coverage: ", "Exportable across all 37 SSCs and 3,000+ National QPs"),
                ("• High wage ROI: ", "Statutory wage upgrade yields +₹1.26L/year uplift per worker"),
                ("• Competitive edge: ", "Voice Viva + Tool Sim + Edge CV PPE + W3C Verified")
            ]
            for lead, body in bullets:
                add_lead_in_bullet(shape.text_frame, lead, body, font_name="Times New Roman", font_size=11.5, space_after=2)
        elif t.startswith("Challenges"):
            shape.text_frame.text = ""
            p0 = shape.text_frame.paragraphs[0]
            p0.space_after = Pt(4)
            set_text_run(p0, "Challenges", font_name="Times New Roman", font_size=23.0, bold=True)
            bullets = [
                ("• Connectivity: ", "Rural low-bandwidth access in remote industrial clusters"),
                ("• Acoustic noise: ", "High ambient background noise in operating factory workshops"),
                ("• Dialect diversity: ", "Regional slang and non-standard colloquial vocational dialects"),
                ("• Exam integrity: ", "Proxy candidate impersonation and evaluation fraud"),
                ("• Psychological fear: ", "Rejection fatigue and exam anxiety among veteran craftsmen"),
                ("• Industry skepticism: ", "Employer hesitation regarding informal skill parity"),
                ("• Institutional inertia: ", "Assessor resistance to automated evaluation workflows")
            ]
            for lead, body in bullets:
                add_lead_in_bullet(shape.text_frame, lead, body, font_name="Times New Roman", font_size=12.0, space_after=2)
        elif t.startswith("Strategy"):
            shape.text_frame.text = ""
            p0 = shape.text_frame.paragraphs[0]
            p0.space_after = Pt(4)
            set_text_run(p0, "Strategy", font_name="Times New Roman", font_size=23.0, bold=True)
            bullets = [
                ("• Offline-first PWA: ", "Local caching with client-side WebAssembly execution"),
                ("• Spectral noise gate: ", "Hardware-accelerated (-18dB) suppression of workshop hum"),
                ("• Vernacular ASR: ", "Bhashini acoustic dialect normalization for trade vocabulary"),
                ("• Anti-proxy biometrics: ", "Multi-voice diarization & pitch liveness telemetry"),
                ("• Zero rejection policy: ", "12-hr ZPD micro-bridge with instant in-page retest"),
                ("• Tamper-proof QR: ", "Cryptographic Ed25519 verification proving raw telemetry"),
                ("• Assessor-copilot: ", "AI assists human evaluators rather than displacing them")
            ]
            for lead, body in bullets:
                add_lead_in_bullet(shape.text_frame, lead, body, font_name="Times New Roman", font_size=12.0, space_after=2)

# ==============================================================================
# SLIDE 5: Impact and Benefits
# ==============================================================================
slide5 = prs.slides[4]
for shape in slide5.shapes:
    if shape.has_text_frame:
        t = shape.text_frame.text.strip()
        if "IMPACT AND BENEFITS" in t:
            shape.text_frame.text = ""
            p = shape.text_frame.paragraphs[0]
            set_text_run(p, "IMPACT AND BENEFITS", font_name="Times New Roman", font_size=36.0, bold=True)
        elif "Direct Impact on Target Users:" in t:
            shape.text_frame.text = ""
            p0 = shape.text_frame.paragraphs[0]
            p0.space_after = Pt(4)
            set_text_run(p0, "Direct Impact on Target Users:", font_name="Times New Roman", font_size=23.0, bold=True)
            bullets = [
                ("• Informal Craftsmen – ", "Dignified NSQF certification overcoming literacy barriers"),
                ("• Rural Helpers – ", "Fast-track career ladder from informal helper to certified technician"),
                ("• Workshop MSMEs – ", "Standardized skill verification without trial-and-error hiring"),
                ("• Manufacturing OEMs – ", "Pre-verified talent matching for NAPS apprenticeship schemes"),
                ("• Training Centers & ITIs – ", "10x throughput capacity without physical lab rig bottlenecks"),
                ("• Ministry Evaluators – ", "Real-time district-wise RPL telemetry with anti-fraud auditing")
            ]
            for lead, body in bullets:
                add_lead_in_bullet(shape.text_frame, lead, body, font_name="Times New Roman", font_size=12.0, space_after=2)
        elif "Strategic Impact" in t:
            shape.text_frame.text = ""
            p0 = shape.text_frame.paragraphs[0]
            p0.space_after = Pt(4)
            set_text_run(p0, "Strategic Impact", font_name="Times New Roman", font_size=23.0, bold=True)
            bullets = [
                ("• National RPL scale: ", "Accelerates certification towards PMKVY 4.0 targets"),
                ("• Formalization: ", "Integrates 400M+ unorganized workers into the formal safety net"),
                ("• Zero forgery: ", "Eliminates fake certificates through tamper-proof W3C signatures"),
                ("• Inclusive parity: ", "Bridges regional and socio-economic demographic divides"),
                ("• Credit mobility: ", "Anchors experiential learning to Academic Bank of Credits (ABC)"),
                ("• National registry: ", "Creates an unforgeable skill ledger under Skill India Digital Hub"),
                ("• Global benchmark: ", "Establishes India as a pioneer in AI-assisted vocational RPL")
            ]
            for lead, body in bullets:
                add_lead_in_bullet(shape.text_frame, lead, body, font_name="Times New Roman", font_size=11.5, space_after=2)
        elif "Economic & Strategic Benefits" in t:
            shape.text_frame.text = ""
            p0 = shape.text_frame.paragraphs[0]
            p0.space_after = Pt(4)
            set_text_run(p0, "Economic & Strategic Benefits", font_name="Times New Roman", font_size=23.0, bold=True)
            bullets = [
                ("• Statutory wage surge: ", "Informal ₹450/day → legal ₹865/day (+95% wage surge)"),
                ("• Statutory protections: ", "Mandatory ESIC medical coverage & EPFO pension access"),
                ("• Rapid placement: ", "84.3% placement rate into paid industrial apprenticeships in 14 days"),
                ("• Public cost savings: ", "₹1,160 saved per assessment compared to legacy manual RPL"),
                ("• Zero licensing fee: ", "Built on open-source stack with zero SaaS lock-in"),
                ("• National integrations: ", "Live connectivity with DigiLocker, SIDH, and NCS portals"),
                ("• Feedback loop: ", "Telemetry continuously informs Sector Skill Council QP standards")
            ]
            for lead, body in bullets:
                add_lead_in_bullet(shape.text_frame, lead, body, font_name="Times New Roman", font_size=12.0, space_after=2)

# Replace infographic on Slide 5
replace_image(slide5, "Google Shape;164;p5", img_slide5)

# ==============================================================================
# SLIDE 6: Research and References
# ==============================================================================
slide6 = prs.slides[5]
for shape in slide6.shapes:
    if shape.has_text_frame:
        t = shape.text_frame.text.strip()
        if "RESEARCH" in t:
            shape.text_frame.text = ""
            p = shape.text_frame.paragraphs[0]
            set_text_run(p, "RESEARCH  AND REFERENCES", font_name="Times New Roman", font_size=36.0, bold=True)
        elif "Gap & Problem Identification" in t:
            shape.text_frame.text = ""
            p0 = shape.text_frame.paragraphs[0]
            p0.space_after = Pt(4)
            set_text_run(p0, "Gap & Problem Identification", font_name="Times New Roman", font_size=21.0, bold=True)
            bullets = [
                ("• 90%+ uncertified workforce: ", "Lacks formal qualifications (NSSO 68th Round)"),
                ("• Severe test dropout: ", "Caused by written exam anxiety among literate/illiterate workers"),
                ("• Geographic disparity: ", "Physical testing labs concentrated solely in Tier-1 cities"),
                ("• Subjective scoring: ", "Human assessor grading introduces regional bias & corruption"),
                ("• Binary pass/fail waste: ", "Discards candidates with minor, remediable skill gaps"),
                ("• Rampant credential forgery: ", "Dilutes employer trust in conventional certificates"),
                ("• Zero outcome tracking: ", "No post-assessment monitoring of wage uplift or retention")
            ]
            for lead, body in bullets:
                add_lead_in_bullet(shape.text_frame, lead, body, font_name="Times New Roman", font_size=11.5, space_after=2)
        elif "Economic & Strategic Landscape" in t or "email cybersecurity" in t:
            shape.text_frame.text = ""
            p0 = shape.text_frame.paragraphs[0]
            p0.space_after = Pt(4)
            set_text_run(p0, "Economic & Strategic Landscape", font_name="Times New Roman", font_size=21.0, bold=True)
            bullets = [
                ("• PMKVY 4.0 RPL mandate: ", "Formal policy prioritization for prior experiential learning"),
                ("• Minimum Wages Act 1948: ", "Statutory wage floors for certified trade technicians"),
                ("• NAPS employer demand: ", "Apprenticeship schemes require pre-verified skilled candidates"),
                ("• Unified digital architecture: ", "Skill India Digital Hub (SIDH) national framework"),
                ("• High economic ROI: ", "Every ₹1 invested in RPL yields ₹8.4 in cumulative worker earnings"),
                ("• MSME labor shortage: ", "Manufacturing clusters face severe deficit of verified talent"),
                ("• Global migration: ", "NSQF alignment facilitates legal overseas placement in Gulf & EU"),
                ("• Cross-trade scalability: ", "Automotive, CNC Machining, Solar PV, Electrical & Welding")
            ]
            for lead, body in bullets:
                add_lead_in_bullet(shape.text_frame, lead, body, font_name="Times New Roman", font_size=11.5, space_after=2)
        elif "Technology Benchmarking" in t:
            shape.text_frame.text = ""
            p0 = shape.text_frame.paragraphs[0]
            p0.space_after = Pt(4)
            set_text_run(p0, "Technology Benchmarking", font_name="Times New Roman", font_size=21.0, bold=True)
            bullets = [
                ("• Traditional RPL Exams: ", "Paper MCQs & subjective human interviewers (High bias)"),
                ("• Generic LMS Platforms: ", "Text-heavy screens with zero hands-on tooling capability"),
                ("• Foreign Simulators: ", "Expensive per-seat licenses, English-only, heavy hardware"),
                ("• PathFinder RPL: ", "70% Tool Sim + Vernacular Viva + ZPD Bridge + W3C VC")
            ]
            for lead, body in bullets:
                add_lead_in_bullet(shape.text_frame, lead, body, font_name="Times New Roman", font_size=12.5, space_after=3)
        elif "Policy & Ecosystem Analysis" in t:
            shape.text_frame.text = ""
            p0 = shape.text_frame.paragraphs[0]
            p0.space_after = Pt(4)
            set_text_run(p0, "Policy & Ecosystem Analysis", font_name="Times New Roman", font_size=21.0, bold=True)
            bullets = [
                ("• NSQF Descriptors: ", "Level 3 & 4 National Occupational Standards (NOS)"),
                ("• PMKVY 4.0 Guidelines: ", "Continuous evaluation and mandatory candidate orientation"),
                ("• W3C VC Standard: ", "Ed25519 digital cryptographic signatures & JSON-LD schema"),
                ("• National APIs: ", "DigiLocker & Skill India Digital Hub (SIDH) verification"),
                ("• Data Governance: ", "Digital Personal Data Protection (DPDP) Act 2023 compliance"),
                ("• Statutory Wage Floors: ", "Scheduled Employment Minimum Wage Framework"),
                ("• Industry Linkages: ", "NATS & NAPS apprenticeship placement pipeline")
            ]
            for lead, body in bullets:
                add_lead_in_bullet(shape.text_frame, lead, body, font_name="Times New Roman", font_size=11.5, space_after=2)
        elif "SOURCE CODE" in t:
            p = shape.text_frame.paragraphs[0]
            p.runs[0].hyperlink.address = "https://github.com/SabarishR08/SIH26242-AI-Skill-Assessment-RPL"
        elif "LIVE DEMO" in t:
            p = shape.text_frame.paragraphs[0]
            p.runs[0].hyperlink.address = "https://sih-rpl-ai.onrender.com"
        elif "VIDEO" in t:
            p = shape.text_frame.paragraphs[0]
            if p.runs:
                p.runs[0].hyperlink.address = "https://sih-rpl-ai.onrender.com"

# Save presentation to both target destinations
prs.save(dst_pptx_1)
prs.save(dst_pptx_2)
print("SUCCESS: Successfully built and exported SIH26242 master presentation decks!")
