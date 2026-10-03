export interface NOSUnit {
  code: string;
  title: string;
  titleHindi: string;
  titleMarathi: string;
  weight: number; // percentage of total score
  criticalSafety: boolean;
  keyCompetencies: string[];
}

export interface VivaQuestion {
  id: string;
  nosCode: string;
  questionEn: string;
  questionHi: string;
  questionMr: string;
  audioPromptTextHi: string;
  audioPromptTextMr: string;
  expectedKeywords: string[];
  evaluationRubric: {
    excellent: string;
    adequate: string;
    inadequate: string;
  };
  sampleAnswerHi: string;
  sampleAnswerEn: string;
}

export interface PracticalScenario {
  id: string;
  nosCode: string;
  title: string;
  titleHindi: string;
  category: "TOOL_INSPECTION" | "FAULT_DIAGNOSIS" | "SAFETY_PPE" | "WIRING_TRACING";
  scenarioDescription: string;
  scenarioDescriptionHindi: string;
  imageUrl?: string;
  inspectionPoints: {
    id: string;
    label: string;
    isDefectOrCritical: boolean;
    explanation: string;
  }[];
  correctActionEn: string;
  correctActionHi: string;
}

export interface RPLBridgeModule {
  nosCode: string;
  title: string;
  titleHindi: string;
  hoursRequired: number;
  learningOutcomes: string[];
  practicalChecklist: string[];
  audioGuideAvailable: boolean;
}

export interface QualificationPack {
  id: string;
  qpCode: string;
  title: string;
  titleHindi: string;
  titleMarathi: string;
  sectorSkillCouncil: string;
  nsqfLevel: number;
  minExperienceMonths: number;
  theoryWeight: number; // typically 30%
  practicalWeight: number; // typically 70%
  passThreshold: number; // 70%
  nosUnits: NOSUnit[];
  vivaQuestions: VivaQuestion[];
  practicalScenarios: PracticalScenario[];
  bridgeModules: RPLBridgeModule[];
}

export const QUALIFICATION_PACKS: Record<string, QualificationPack> = {
  "auto-service-tech-l4": {
    id: "auto-service-tech-l4",
    qpCode: "ASC/Q1402",
    title: "Automotive Service Technician",
    titleHindi: "ऑटोमोटिव सर्विस तकनीशियन",
    titleMarathi: "ऑटोमोटिव सर्व्हिस मेकॅनिक",
    sectorSkillCouncil: "Automotive Skills Development Council (ASDC)",
    nsqfLevel: 4,
    minExperienceMonths: 24,
    theoryWeight: 30,
    practicalWeight: 70,
    passThreshold: 70,
    nosUnits: [
      {
        code: "ASC/N1401",
        title: "Carry Out Routine Vehicle Service & Oil Inspection",
        titleHindi: "नियमित वाहन सर्विसिंग और ऑयल जांच",
        titleMarathi: "नियमित वाहन सर्व्हिसिंग आणि ऑइल तपासणी",
        weight: 25,
        criticalSafety: false,
        keyCompetencies: ["Engine Oil Viscosity Check", "Coolant Reservoir Level", "Filter Replacement", "Air Cleaner Servicing"]
      },
      {
        code: "ASC/N1402",
        title: "Diagnose and Repair Braking & Suspension Systems",
        titleHindi: "ब्रेकिंग और सस्पेंशन सिस्टम की जांच और मरम्मत",
        titleMarathi: "ब्रेकिंग आणि सस्पेंशन सिस्टम तपासणे",
        weight: 35,
        criticalSafety: true,
        keyCompetencies: ["Hydraulic Brake Bleeding", "Disc Rotor Runout Measurement", "ABS Sensor Testing", "Shock Absorber Leak Check"]
      },
      {
        code: "ASC/N1403",
        title: "BS-VI OBD-II Diagnostic Telemetry & Electrical Fault Tracing",
        titleHindi: "बीएस-६ ओबीडी-२ डायग्नोस्टिक और वायरिंग फॉल्ट",
        titleMarathi: "बीएस-६ ओबीडी-२ स्कॅनर आणि इलेक्ट्रिकल फॉल्ट",
        weight: 25,
        criticalSafety: false,
        keyCompetencies: ["OBD-II Scanner Code Reading (DTC)", "Multimeter Voltage Drop Test", "Sensor Pinout Verification", "CAN-Bus Telemetry"]
      },
      {
        code: "ASC/N0001",
        title: "Workshop Health, Safety and Chemical Waste Disposal",
        titleHindi: "वर्कशॉप स्वास्थ्य, सुरक्षा और अपशिष्ट निपटान",
        titleMarathi: "वर्कशॉप आरोग्य, सुरक्षा आणि कचरा विल्हेवाट",
        weight: 15,
        criticalSafety: true,
        keyCompetencies: ["Hydraulic Jack Safety Locking", "Flammable Liquid Handling", "PPE Utilization", "Spill Kit Deployment"]
      }
    ],
    vivaQuestions: [
      {
        id: "viva-auto-1",
        nosCode: "ASC/N1402",
        questionEn: "If a vehicle pulls sharply to the left during hard braking and the pedal feels spongy, what are the primary root causes and how would you verify them?",
        questionHi: "अगर ब्रेक लगाने पर गाड़ी तेजी से बाईं ओर खिंचती है और ब्रेक पेडल स्पंजी महसूस होता है, तो इसके मुख्य कारण क्या हैं और आप कैसे जांच करेंगे?",
        questionMr: "ब्रेक दाबल्यावर गाडी डाव्या बाजूला ओढत असेल आणि ब्रेक पेडल स्पंजी लागत असेल, तर याची मुख्य कारणे काय आहेत आणि तुम्ही तपासणी कशी कराल?",
        audioPromptTextHi: "गाड़ी ब्रेक लगाने पर बाईं तरफ खिंच रही है और पेडल स्पंजी है। आप इस समस्या को कैसे ठीक करेंगे?",
        audioPromptTextMr: "ब्रेक दाबल्यावर गाडी डाव्या बाजूला ओढते आणि पेडल स्पंजी वाटते. तुम्ही हे कसे दुरुस्त कराल?",
        expectedKeywords: ["air in hydraulic lines", "brake bleeding", "caliper sticking", "uneven pad wear", "brake fluid leak", "हवा निकालना", "ब्लिडिंग", "कॅलिपर"],
        evaluationRubric: {
          excellent: "Identifies air in hydraulic line causing spongy pedal AND uneven caliper pressure or seized piston causing vehicle pull. Mentions two-person bleeding or pressure bleeding.",
          adequate: "Mentions brake bleeding or low brake fluid and checking the brake pads.",
          inadequate: "Suggests wheel alignment without diagnosing hydraulic brake pressure disparity."
        },
        sampleAnswerHi: "स्पंजी पेडल का मतलब है कि हाइड्रोलिक ब्रेक लाइनों में हवा घुस गई है। हम ब्रेक ब्लीडिंग करेंगे। बाईं ओर खिंचने का कारण दायां कैलिपर जाम होना या बायीं डिस्क पर ज्यादा ग्रिप होना हो सकता है।",
        sampleAnswerEn: "A spongy pedal indicates entrapped air in hydraulic brake lines requiring bleeding. Vehicle pulling indicates a stuck caliper piston or uneven friction lining wear."
      },
      {
        id: "viva-auto-2",
        nosCode: "ASC/N1403",
        questionEn: "How do you connect an OBD-II scanner to diagnose a Check Engine light displaying DTC P0300 (Random/Multiple Cylinder Misfire)?",
        questionHi: "चेक इंजन लाइट जलने पर और एरर कोड P0300 आने पर आप ओबीडी-२ स्कैनर से मिसफायर की जांच कैसे करेंगे?",
        questionMr: "चेक इंजिन लाइट चालू झाल्यावर P0300 कोड आला तर तुम्ही ओबीडी-२ स्कॅनरने मिसफायर कसा शोधाल?",
        audioPromptTextHi: "कोड P0300 आने पर आप किन कंपोनेंट्स को चेक करेंगे?",
        audioPromptTextMr: "P0300 कोड आल्यावर तुम्ही कोणत्या भागांची तपासणी कराल?",
        expectedKeywords: ["spark plug", "ignition coil", "fuel injector", "fuel pressure", "OBD port under dashboard", "स्पार्क प्लग", "इग्निशन कॉइल"],
        evaluationRubric: {
          excellent: "Connects scanner to 16-pin DLC under dashboard, reads live misfire counter data across cylinders, checks spark plugs, ignition coils, and fuel rail pressure.",
          adequate: "Mentions checking spark plug, coil or wire after connecting scanner.",
          inadequate: "Does not know DTC P0300 represents random misfire."
        },
        sampleAnswerHi: "डैशबोर्ड के नीचे 16-पिन पोर्ट में स्कैनर लगाकर लाइव डेटा देखेंगे। P0300 का मतलब रैंडम मिसफायर है, तो स्पार्क प्लग, इग्निशन कॉइल और फ्यूल इंजेक्टर प्रेशर चेक करेंगे।",
        sampleAnswerEn: "Connect scanner to 16-pin DLC, verify live misfire counts per cylinder, inspect spark plugs, coils, and fuel delivery."
      }
    ],
    practicalScenarios: [
      {
        id: "prac-auto-1",
        nosCode: "ASC/N1402",
        title: "Brake Disc & Caliper Visual Defect Inspection",
        titleHindi: "डिस्क ब्रेक और कैलिपर विजुअल डिफेक्ट इंस्पेक्शन",
        category: "TOOL_INSPECTION",
        scenarioDescription: "Inspect the front disc brake assembly removed from a commercial taxi reporting vibration at 60 km/h.",
        scenarioDescriptionHindi: "६० किमी/घंटा की गति पर कांपने वाली टैक्सी के डिस्क ब्रेक असेंबली का निरीक्षण करें।",
        inspectionPoints: [
          { id: "p1", label: "Deep circumferential scoring grooves on rotor surface (>1.5mm)", isDefectOrCritical: true, explanation: "Severe disc scoring requires resurfacing or disc replacement if under minimum thickness." },
          { id: "p2", label: "Caliper rubber dust boot torn with grease leakage", isDefectOrCritical: true, explanation: "Torn dust boot allows dirt into caliper piston, causing brake seizure." },
          { id: "p3", label: "Brake pad friction material thickness at 7mm", isDefectOrCritical: false, explanation: "7mm is well above minimum wear threshold of 2mm." }
        ],
        correctActionEn: "Replace brake disc rotor and rebuild caliper with new seal kit and fresh DOT-4 fluid.",
        correctActionHi: "डिस्क रोटर बदलें और कैलिपर रबर बूट किट लगाकर डीओटी-४ फ्लुइड भरें।"
      }
    ],
    bridgeModules: [
      {
        nosCode: "ASC/N1403",
        title: "12-Hour Micro-Bridge: BS-VI OBD-II Diagnostic Telemetry & Sensor Calibration",
        titleHindi: "१२ घंटे का ब्रिज कोर्स: बीएस-६ ओबीडी-२ डायग्नोस्टिक्स और सेंसर कैलिब्रेशन",
        hoursRequired: 12,
        learningOutcomes: [
          "Connect and operate standard 16-pin OBD-II scan tools",
          "Interpret DTC fault codes P0100 through P0420 (Air, Fuel, Emissions)",
          "Perform live Lambda O2 sensor voltage sweep tests"
        ],
        practicalChecklist: [
          "Scan tool connection on BS-VI vehicle",
          "Clearing pending codes after sensor replacement",
          "Throttle position sensor (TPS) relearn procedure"
        ],
        audioGuideAvailable: true
      }
    ]
  },
  "cnc-machinist-l4": {
    id: "cnc-machinist-l4",
    qpCode: "CSC/Q0115",
    title: "CNC Machinist & Turning Operator",
    titleHindi: "सीएनसी मशिनिस्ट और टर्निंग ऑपरेटर",
    titleMarathi: "सीएनसी मशिनिस्ट आणि टर्निंग ऑपरेटर",
    sectorSkillCouncil: "Capital Goods Skill Council (CGSC)",
    nsqfLevel: 4,
    minExperienceMonths: 24,
    theoryWeight: 30,
    practicalWeight: 70,
    passThreshold: 70,
    nosUnits: [
      {
        code: "CSC/N0115",
        title: "Set-Up and Operate CNC Lathe / Turning Centre",
        titleHindi: "सीएनसी लेथ मशीन सेटअप और ऑपरेशन",
        titleMarathi: "सीएनसी लेथ मशीन सेटअप आणि ऑपरेशन",
        weight: 35,
        criticalSafety: true,
        keyCompetencies: ["Workpiece Clamping in 3-Jaw Chuck", "Tool Offset Setting (X & Z)", "G-Code & M-Code Execution", "Spindle Speed RPM Calculation"]
      },
      {
        code: "CSC/N0116",
        title: "In-Process Precision Metrology & CMM Inspection",
        titleHindi: "प्रेसिजन मेट्रोलॉजी और माइक्रोमीटर मापन",
        titleMarathi: "प्रिसिजन मोजमाप आणि मायक्रोमीटर तपासणी",
        weight: 35,
        criticalSafety: false,
        keyCompetencies: ["Digital Vernier Caliper (0.01mm)", "Outside Micrometer Usage (0.001mm)", "Bore Dial Gauge", "Surface Roughness Ra Verification"]
      },
      {
        code: "CSC/N0002",
        title: "Workshop 5S, Emergency E-Stop and Coolant Maintenance",
        titleHindi: "वर्कशॉप 5S, आपातकालीन ई-स्टॉप और कूलेंट रख-रखाव",
        titleMarathi: "वर्कशॉप 5S, इमर्जन्सी ई-स्टॉप आणि कुलंट देखभाल",
        weight: 30,
        criticalSafety: true,
        keyCompetencies: ["Emergency Stop Protocol", "Water-Soluble Coolant Refractometer Test", "Chip Conveyor Jam Clearance", "Personal Protective Equipment"]
      }
    ],
    vivaQuestions: [
      {
        id: "viva-cnc-1",
        nosCode: "CSC/N0115",
        questionEn: "How do you take the Z-axis and X-axis tool geometry offsets on a CNC turning machine using a 0.02mm shim stock or touch-probe?",
        questionHi: "सीएनसी टर्निंग मशीन पर 0.02 मिमी शिम या टच विधि से टूल ज्योमेट्री ऑफसेट (X और Z) कैसे लेते हैं?",
        questionMr: "सीएनसी मशीनवर टूल ऑफसेट (X आणि Z) घेण्याची योग्य पद्धत सांगा.",
        audioPromptTextHi: "सीएनसी मशीन पर टूल टच करने के बाद वर्क कोऑर्डिनेट ऑफसेट कैसे रजिस्टर करेंगे?",
        audioPromptTextMr: "सीएनसी मशीनवर टूल टच केल्यावर कोऑर्डिनेट कसे सेव्ह कराल?",
        expectedKeywords: ["tool touch", "face off Z0", "turn diameter X", "micrometer measurement", "G54 work offset", "ऑफसेट", "डायमीटर"],
        evaluationRubric: {
          excellent: "Accurately details skimming the face to define Z=0, turning a test OD diameter, measuring with micrometer, and entering into Tool Geometry screen.",
          adequate: "Mentions touching the tool to the face and diameter, then entering values in offset.",
          inadequate: "Does not distinguish between Work Offset (G54) and Tool Geometry Offset."
        },
        sampleAnswerHi: "पहले वर्कपीस के फेस पर टूल टच करके Z=0 दबाते हैं। फिर बाहरी डायमीटर पर हल्की कट लगाकर माइक्रोमीटर से नापते हैं और वह मान टूल ऑफसेट X में दर्ज करते हैं।",
        sampleAnswerEn: "Skim the workpiece face, register Z=0. Turn an OD skim cut, measure diameter with micrometer, and enter into tool geometry X register."
      }
    ],
    practicalScenarios: [
      {
        id: "prac-cnc-1",
        nosCode: "CSC/N0116",
        title: "Precision Outside Micrometer Scale Reading Challenge",
        titleHindi: "प्रिसिजन आउटसाइड माइक्रोमीटर स्केल रीडिंग",
        category: "TOOL_INSPECTION",
        scenarioDescription: "Read the measurement on a 25-50mm outside micrometer measuring a critical pin tolerance (Target: 34.28 ± 0.01mm).",
        scenarioDescriptionHindi: "२५-५० मिमी माइक्रोमीटर पर माप पढ़ें (लक्ष्य: ३४.२८ ± ०.०१ मिमी)।",
        inspectionPoints: [
          { id: "m1", label: "Main sleeve scale reading reads 34.00mm", isDefectOrCritical: false, explanation: "34mm line clearly uncovered on barrel." },
          { id: "m2", label: "Thimble scale division 28 aligned with datum line (0.28mm)", isDefectOrCritical: false, explanation: "Total reading: 34.28mm, matching target tolerance." },
          { id: "m3", label: "Zero-error offset not recalibrated with spanner (+0.03mm drift)", isDefectOrCritical: true, explanation: "An uncalibrated micrometer introduces systematic batch error." }
        ],
        correctActionEn: "Calibrate micrometer zero using 25mm standard test gauge before certifying batch.",
        correctActionHi: "बैच प्रमाणीकरण से पहले मानक गेज से माइक्रोमीटर का जीरो एरर ठीक करें।"
      }
    ],
    bridgeModules: [
      {
        nosCode: "CSC/N0115",
        title: "12-Hour Micro-Bridge: 5-Axis Fanuc G-Code Optimization & Canned Cycles (G71/G76)",
        titleHindi: "१२ घंटे का ब्रिज कोर्स: ५-एक्सिस फॅनुक जी-कोड और कैनड साइकल (G71/G76)",
        hoursRequired: 12,
        learningOutcomes: [
          "Program multi-pass turning canned cycles (G71 roughing, G70 finishing)",
          "Thread cutting cycle execution (G76)",
          "Tool life management telemetry"
        ],
        practicalChecklist: [
          "Writing 15-line G-code program on Fanuc controller",
          "Dry run simulation without workpiece",
          "First-article dimensional inspection"
        ],
        audioGuideAvailable: true
      }
    ]
  },
  "solar-pv-tech-l4": {
    id: "solar-pv-tech-l4",
    qpCode: "PSS/Q0101",
    title: "Solar PV Project Technician & Rooftop Installer",
    titleHindi: "सोलर पीवी प्रोजेक्ट तकनीशियन",
    titleMarathi: "सोलर रूफटॉप इन्स्टॉलेशन मेकॅनिक",
    sectorSkillCouncil: "Skill Council for Green Jobs (SCGJ)",
    nsqfLevel: 4,
    minExperienceMonths: 18,
    theoryWeight: 30,
    practicalWeight: 70,
    passThreshold: 70,
    nosUnits: [
      {
        code: "SGJ/N0101",
        title: "Site Survey & Rooftop Structural Civil Feasibility",
        titleHindi: "साइट सर्वे और छत लोड क्षमता विश्लेषण",
        titleMarathi: "साइट सर्वेक्षण आणि छताची लोड क्षमता",
        weight: 25,
        criticalSafety: true,
        keyCompetencies: ["Compass Azimuth Orientation", "Shadow Analysis at Solar Noon", "Dead Load Calculation", "Wind Speed Resistance"]
      },
      {
        code: "SGJ/N0102",
        title: "DC String Wiring, Inverter & Earthing Installation",
        titleHindi: "डीसी स्ट्रिंग वायरिंग, इन्वर्टर और अर्थिंग पिट स्थापना",
        titleMarathi: "डीसी वायरिंग, इन्व्हर्टर आणि अर्थिंग",
        weight: 45,
        criticalSafety: true,
        keyCompetencies: ["MC4 Connector Crimping", "String Voc / Isc Testing with Multimeter", "Surge Protection Device (SPD) Wiring", "Earth Pit Resistance <5 Ohms"]
      },
      {
        code: "SGJ/N0103",
        title: "Grid Synchronization & Net-Metering Commissioning",
        titleHindi: "ग्रिड सिंक्रोनाइज़ेशन और नेट-मीटरिंग कमीशनिंग",
        titleMarathi: "ग्रीड सिंक्रोनाइझेशन आणि नेट-मीटरिंग",
        weight: 30,
        criticalSafety: false,
        keyCompetencies: ["Anti-Islanding Protection Verification", "Bi-directional Meter Testing", "DISCOM Interconnection Compliance"]
      }
    ],
    vivaQuestions: [
      {
        id: "viva-solar-1",
        nosCode: "SGJ/N0102",
        questionEn: "Why is correct MC4 connector crimping essential, and what danger occurs if connections have high resistance under a 600V DC solar string?",
        questionHi: "एमसी-४ कनेक्टर की सही क्रिम्पिंग क्यों जरूरी है, और ६०० वोल्ट डीसी स्ट्रिंग में ढीला कनेक्शन होने पर क्या खतरा होता है?",
        questionMr: "एमसी-४ कनेक्टर योग्य क्रिम्प का केले पाहिजे आणि लूज कनेक्शनमुळे काय धोका होतो?",
        audioPromptTextHi: "डीसी स्ट्रिंग में लूज कनेक्शन होने से क्या हो सकता है?",
        audioPromptTextMr: "सोलर डीसी वायर लूज राहिल्यास काय धोका निर्माण होतो?",
        expectedKeywords: ["DC arc", "fire hazard", "crimping tool", "hotspot", "high resistance", "आग", "डीसी आर्क"],
        evaluationRubric: {
          excellent: "Explains that DC current does not cross zero voltage, creating dangerous non-extinguishing DC arcs and catastrophic rooftop fire hazards. Must specify using dedicated solar crimping pliers.",
          adequate: "Mentions heating, fire risk, or poor electricity generation.",
          inadequate: "Thinks DC connections are as low-risk as standard AC household plugs."
        },
        sampleAnswerHi: "डीसी करंट में स्पार्क होने पर आग (DC Arc) बुझती नहीं है और छत पर भीषण आग लग सकती है। इसलिए स्पेशल सोलर क्रिम्पिंग टूल से कसकर टाइट करना अनिवार्य है।",
        sampleAnswerEn: "DC current creates self-sustaining electrical arcs with high fire hazard. Dedicated ratcheting solar crimping tools ensure low contact resistance."
      }
    ],
    practicalScenarios: [
      {
        id: "prac-solar-1",
        nosCode: "SGJ/N0102",
        title: "Solar Rooftop Array Safety & Earthing Hazard Audit",
        titleHindi: "सोलर रूफटॉप अर्थिंग और सेफ्टी ऑडिट",
        category: "SAFETY_PPE",
        scenarioDescription: "Audit a 10 kWp commercial rooftop installation before connecting to the DISCOM grid.",
        scenarioDescriptionHindi: "ग्रिड चालू करने से पहले १० किलोवाट रूफटॉप सोलर सिस्टम की सुरक्षा जांच करें।",
        inspectionPoints: [
          { id: "s1", label: "Array structural metal frame not bonded to dedicated earth pit", isDefectOrCritical: true, explanation: "Lack of frame bonding creates lethal shock hazard during lightning or string insulation fault." },
          { id: "s2", label: "DC cables exposed directly to UV sunlight without conduit", isDefectOrCritical: true, explanation: "UV radiation degrades insulation within 18 months, causing ground faults." },
          { id: "s3", label: "Solar modules tilted at 18 degrees South with bird-mesh guards installed", isDefectOrCritical: false, explanation: "Complies with Indian latitude installation standards." }
        ],
        correctActionEn: "Install UV-resistant PVC conduits and bond aluminum structure to chemical earth electrode measuring <5 ohms.",
        correctActionHi: "तारों पर यूवी-प्रूफ पाइप लगाएं और पूरे स्ट्रक्चर को अर्थिंग इलेक्ट्रोड से सुरक्षित जोड़ें।"
      }
    ],
    bridgeModules: [
      {
        nosCode: "SGJ/N0102",
        title: "12-Hour Micro-Bridge: Chemical Earthing & Anti-Islanding Protection Protocol",
        titleHindi: "१२ घंटे का ब्रिज कोर्स: केमिकल अर्थिंग और एंटी-आइसलैंडिंग सुरक्षा",
        hoursRequired: 12,
        learningOutcomes: [
          "Construct and test bentonite/chemical earth pits (<5 ohms resistance)",
          "Verify anti-islanding trip times during grid blackout (<2 seconds)",
          "Inspect SPD surge arrestors after thunderstorm events"
        ],
        practicalChecklist: [
          "Earth tester 4-pin resistance measurement",
          "Grid-disconnect live trip test",
          "MC4 waterproof torque verification"
        ],
        audioGuideAvailable: true
      }
    ]
  },
  "electrician-domestic-l4": {
    id: "electrician-domestic-l4",
    qpCode: "ELE/Q6001",
    title: "Domestic Solutions Electrician",
    titleHindi: "घरेलू विद्युत तकनीशियन (इलेक्ट्रीशियन)",
    titleMarathi: "घरगुती वायरमन / इलेक्ट्रिशियन",
    sectorSkillCouncil: "Electronics & Power Sector Skill Council",
    nsqfLevel: 4,
    minExperienceMonths: 24,
    theoryWeight: 30,
    practicalWeight: 70,
    passThreshold: 70,
    nosUnits: [
      {
        code: "ELE/N6001",
        title: "Install Internal Concealed & Surface Wiring in Domestic Buildings",
        titleHindi: "आंतरिक घरेलू वायरिंग और डिस्ट्रीब्यूशन बॉक्स सेटअप",
        titleMarathi: "घरगुती वायरिंग आणि वितरण बोर्ड स्थापना",
        weight: 30,
        criticalSafety: false,
        keyCompetencies: ["Conduit Bending & Fixing", "Wire Gauge Sizing (1.5/2.5/4 sq mm)", "Phase Balance", "Color Coding"]
      },
      {
        code: "ELE/N6002",
        title: "Diagnose Faults in Single-Phase & Three-Phase Consumer Units",
        titleHindi: "सिंगल और थ्री-फेज फॉल्ट डायग्नोसिस और सुधार",
        titleMarathi: "सिंगल व थ्री-फेज विद्युत दोष निवारण",
        weight: 35,
        criticalSafety: true,
        keyCompetencies: ["Megger Insulation Test", "Continuity Testing", "Short-Circuit Tracing", "Voltage Drop Analysis"]
      },
      {
        code: "ELE/N6003",
        title: "Earth Resistance Testing and RCCB / ELCB Protection Verification",
        titleHindi: "अर्थिंग रेजिस्टेंस जांच और आरसीसीबी सुरक्षा परीक्षण",
        titleMarathi: "अर्थिंग तपासणी आणि आरसीसीबी सुरक्षा चाचणी",
        weight: 20,
        criticalSafety: true,
        keyCompetencies: ["Earth Pit Resistance Measurement (<5 Ohms)", "RCCB 30mA Trip Timing Test", "Neutral Leakage Isolation"]
      },
      {
        code: "ELE/N9901",
        title: "Electrical Safety, Shock Treatment & Fire Extinguisher Utilization",
        titleHindi: "विद्युत सुरक्षा, शॉक प्राथमिक उपचार और सुरक्षा उपकरण",
        titleMarathi: "विद्युत सुरक्षा, शॉक प्रथमोपचार आणि सुरक्षितता",
        weight: 15,
        criticalSafety: true,
        keyCompetencies: ["Lockout-Tagout (LOTO)", "Insulated Tool Rating (1000V)", "CO2 Fire Extinguisher Handling"]
      }
    ],
    vivaQuestions: [
      {
        id: "viva-elec-1",
        nosCode: "ELE/N6003",
        questionEn: "What is the exact functional difference between an MCB and an RCCB, and why does an RCCB trip even when total current is well below the breaker rating?",
        questionHi: "एमसीबी (MCB) और आरसीसीबी (RCCB) में क्या अंतर है, और कुल करंट कम होने पर भी आरसीसीबी क्यों ट्रिप हो जाता है?",
        questionMr: "एमसीबी आणि आरसीसीबी यात काय फरक आहे, आणि करंट कमी असूनही आरसीसीबी का ट्रिप होतो?",
        audioPromptTextHi: "एमसीबी और आरसीसीबी में क्या मुख्य अंतर है? आरसीसीबी किस स्थिति में ट्रिप होता है?",
        audioPromptTextMr: "एमसीबी आणि आरसीसीबी मध्ये काय फरक आहे? आरसीसीबी कोणत्या वेळी ट्रिप होतो?",
        expectedKeywords: ["residual current", "earth leakage", "phase neutral imbalance", "shock protection", "overcurrent", "शॉक", "अर्थ लीकेज", "न्यूट्रल"],
        evaluationRubric: {
          excellent: "Explains MCB protects against overcurrent/short-circuit using thermal/magnetic trip, whereas RCCB detects current imbalance between phase and neutral (typically 30mA leakage to ground) to protect human life from lethal shock.",
          adequate: "States that MCB is for overload and RCCB protects humans from electric shock.",
          inadequate: "Confuses RCCB with standard fuse or claims RCCB trips on high voltage."
        },
        sampleAnswerHi: "एमसीबी ओवरलोड और शॉर्ट-सर्किट से बचाता है। जबकि आरसीसीबी फेज और न्यूट्रल के करंट का अंतर मापता है। अगर ३० मिलीएम्पीयर करंट भी जमीन में लीक होता है तो आरसीसीबी तुरंत ट्रिप होकर इंसान की जान बचाता है।",
        sampleAnswerEn: "MCBs protect wiring from overload and short circuits. RCCBs monitor differential current between phase and neutral; even a tiny 30mA leakage to earth trips the RCCB instantly to prevent fatal shocks."
      },
      {
        id: "viva-elec-2",
        nosCode: "ELE/N6001",
        questionEn: "Why is it forbidden to connect single-phase household loads using 1.0 sq mm copper wire for power outlets running 1.5-ton ACs or geysers?",
        questionHi: "गीजर या डेढ़ टन एसी के लिए १ स्क्वायर एमएम तार का इस्तेमाल करना क्यों मना है?",
        questionMr: "गीझर किंवा दीड टन एसी साठी १ स्क्वेअर एमएम वायर का वापरू नये?",
        audioPromptTextHi: "एसी या गीजर के पावर पॉइंट में कम से कम कितने एमएम का तार लगाना चाहिए और क्यों?",
        audioPromptTextMr: "एसी किंवा गीझर साठी कमीत कमी किती एमएम वायर लागते आणि का?",
        expectedKeywords: ["current carrying capacity", "I2R heating", "fire hazard", "voltage drop", "4 sq mm", "तार गर्म होना", "आग का खतरा"],
        evaluationRubric: {
          excellent: "Calculates current demand (~8A-12A), cites 1.0 sq mm wire has max safe ampacity of only 8-10A in conduit, causing excessive I2R heating and insulation breakdown. Specifies minimum 4.0 sq mm for heavy inductive loads.",
          adequate: "Mentions wire will overheat, burn insulation, and can cause a fire. Recommends thicker 4 sq mm wire.",
          inadequate: "Suggests 1 sq mm is fine if an MCB is connected."
        },
        sampleAnswerHi: "डेढ़ टन एसी और गीजर १० से १२ एम्पीयर करंट खींचते हैं। १ एमएम तार केवल ८ एम्पीयर सह सकता है, जिससे तार गर्म होकर पिघल जाएगा और शॉर्ट सर्किट से घर में आग लग सकती है। कम से कम ४ एमएम तार जरूरी है।",
        sampleAnswerEn: "Heavy 1.5-ton ACs pull 10-14A continuous current. A 1 sq mm wire has safe ampacity of under 10A, causing severe I2R thermal heating and melting insulation. A minimum 4.0 sq mm conductor is mandatory."
      }
    ],
    practicalScenarios: [
      {
        id: "prac-elec-1",
        nosCode: "ELE/N6003",
        title: "Consumer Unit & Distribution Board Electrical Hazard Audit",
        titleHindi: "डिस्ट्रीब्यूशन बोर्ड एवं आरसीसीबी सुरक्षा ऑडिट",
        category: "FAULT_DIAGNOSIS",
        scenarioDescription: "Inspect a residential distribution board that trips the main 30mA RCCB every time a kitchen appliance is turned on.",
        scenarioDescriptionHindi: "एक घर का मेन आरसीसीबी कोई भी भारी उपकरण चालू करते ही ट्रिप हो जाता है। बोर्ड की जांच करें।",
        inspectionPoints: [
          { id: "e1", label: "Neutral bar accidentally linked to Earth terminal bar downstream of RCCB", isDefectOrCritical: true, explanation: "Neutral-earth cross bonding causes return current to divide between neutral and ground, immediately creating differential trip current in RCCB." },
          { id: "e2", label: "Main incoming 32A MCB equipped with spark-suppression arc chute", isDefectOrCritical: false, explanation: "Standard BIS compliant breaker component." },
          { id: "e3", label: "Missing rubber grommets on metal knockout holes with cables touching bare metal edges", isDefectOrCritical: true, explanation: "Sharp sheet metal will slice PVC insulation over time, energizing the metal distribution panel." }
        ],
        correctActionEn: "Separate the neutral and earth conductors into isolated busbars downstream of the RCCB, and install protective rubber grommets on all cabinet entries.",
        correctActionHi: "आरसीसीबी के बाद न्यूट्रल और अर्थ को अलग-अलग बसबार में बांटें और धातु के किनारों पर रबर ग्रोमेट लगाएं।"
      }
    ],
    bridgeModules: [
      {
        nosCode: "ELE/N6003",
        title: "12-Hour Micro-Bridge: Earth Loop Impedance & RCCB Nuisance Trip Remediation",
        titleHindi: "१२ घंटे का ब्रिज कोर्स: अर्थ लूप जांच और आरसीसीबी फॉल्ट डायग्नोसिस",
        hoursRequired: 12,
        learningOutcomes: [
          "Measure prospective fault current and earth loop impedance (<1.5 ohms)",
          "Isolate neutral-earth leakage faults using digital clamp meter",
          "Test RCCB trip time at 1x and 5x rated residual operating current"
        ],
        practicalChecklist: [
          "Earth loop tester calibration and outlet testing",
          "Digital insulation tester (Megger 500V DC) across phase-to-earth",
          "Distribution board color-coded re-termination"
        ],
        audioGuideAvailable: true
      }
    ]
  },
  "welder-mmaw-l3": {
    id: "welder-mmaw-l3",
    qpCode: "CSC/Q0204",
    title: "Assistant Welder - MMAW",
    titleHindi: "वेल्डर - मैनुअल मेटल आर्क वेल्डिंग (MMAW)",
    titleMarathi: "वेल्डर - मॅन्युअल मेटल आर्क वेल्डिंग",
    sectorSkillCouncil: "Capital Goods Skill Council",
    nsqfLevel: 3,
    minExperienceMonths: 18,
    theoryWeight: 30,
    practicalWeight: 70,
    passThreshold: 70,
    nosUnits: [
      {
        code: "CSC/N0204",
        title: "Perform Manual Metal Arc Welding (MMAW) on Carbon Steels",
        titleHindi: "कार्बन स्टील पर मैनुअल मेटल आर्क वेल्डिंग करना",
        titleMarathi: "कार्बन स्टील प्लेट्सवर एमएमएडब्ल्यू वेल्डिंग करणे",
        weight: 40,
        criticalSafety: false,
        keyCompetencies: ["Current Setting (Amperage selection)", "Arc Length Maintenance", "Electrode Angle (70-80 deg)", "Travel Speed"]
      },
      {
        code: "CSC/N0205",
        title: "Visual Quality Inspection of Welded Joints & Defect Identification",
        titleHindi: "वेल्ड जॉइंट की गुणवत्ता जांच और दोष पहचान",
        titleMarathi: "वेल्डिंग जॉइंटची तपासणी आणि दोष ओळखणे",
        weight: 35,
        criticalSafety: false,
        keyCompetencies: ["Slag Chipping & Cleaning", "Undercut Detection", "Porosity Inspection", "Root Penetration Check"]
      },
      {
        code: "CSC/N0001",
        title: "Work Safely with High Temperatures, UV Radiation & Heavy Equipment",
        titleHindi: "वेल्डिंग सुरक्षा, यूवी रेडिएशन बचाव और पीपीई",
        titleMarathi: "वेल्डिंग सुरक्षितता, यूव्ही किरण संरक्षण आणि पीपीई",
        weight: 25,
        criticalSafety: true,
        keyCompetencies: ["Welding Helmet Shade 10-12", "Leather Apron & Gauntlets", "Fume Extraction", "Hot Metal Tagging"]
      }
    ],
    vivaQuestions: [
      {
        id: "viva-weld-1",
        nosCode: "CSC/N0204",
        questionEn: "What causes excessive slag inclusion and porosity in a manual metal arc weld, and how do you prevent moisture contamination in 7018 basic electrodes?",
        questionHi: "वेल्डिंग करते समय स्लैग फंसने (Slag Inclusion) और पोरोसिटी (बुलबुले) का क्या कारण होता है, और 7018 इलेक्ट्रोड को नमी से कैसे बचाते हैं?",
        questionMr: "वेल्डिंग करताना स्लॅग अडकणे आणि पोरोसिटी का निर्माण होते, आणि 7018 इलेक्ट्रोड सुरक्षित कसे ठेवावे?",
        audioPromptTextHi: "वेल्डिंग में स्लैग फंसने और पोरोसिटी होने का क्या कारण है? 7018 इलेक्ट्रोड को ओवन में क्यों रखते हैं?",
        audioPromptTextMr: "वेल्डिंग मध्ये स्लॅग अडकण्याचे कारण काय? 7018 इलेक्ट्रोड ओव्हन मध्ये का ठेवतात?",
        expectedKeywords: ["slag inclusion", "porosity", "baking oven", "low hydrogen", "clean slag between passes", "damp electrode", "ओवन", "स्लैग", "नमी"],
        evaluationRubric: {
          excellent: "Identifies failure to chip slag between multiple weld passes causes slag inclusion, while damp electrodes release hydrogen/moisture causing porosity. Explicitly notes basic electrodes (E7018) must be stored in electrode holding ovens at 100°C–150°C.",
          adequate: "Mentions dirty metal, poor chipping of slag, or moist electrodes as main causes.",
          inadequate: "Claims welding faster stops porosity without understanding hydrogen contamination."
        },
        sampleAnswerHi: "अगर पहले पास का स्लैग ठीक से साफ नहीं किया जाए तो वो अगले पास में अंदर दबकर स्लैग इन्क्लूजन बनता है। नमी वाले इलेक्ट्रोड से हाइड्रोजन गैस निकलकर पोरोसिटी बनाती है। 7018 इलेक्ट्रोड को हमेशा हीटिंग ओवन में सूखा रखना चाहिए।",
        sampleAnswerEn: "Failing to thoroughly chip slag between consecutive passes traps slag inside the joint. Damp electrodes release hydrogen moisture causing porosity. E7018 low-hydrogen electrodes must be pre-baked and kept in portable ovens."
      }
    ],
    practicalScenarios: [
      {
        id: "prac-weld-1",
        nosCode: "CSC/N0205",
        title: "Structural Butt Weld Visual Inspection & Defect Audit",
        titleHindi: "वेल्ड बीड गुणवत्ता और संरचनात्मक दोष निरीक्षण",
        category: "TOOL_INSPECTION",
        scenarioDescription: "Visually audit a 10mm structural steel V-butt weld joint prior to ultrasonic non-destructive testing.",
        scenarioDescriptionHindi: "१० मिमी स्टील प्लेट के वेल्ड जॉइंट की दृश्य जांच करें।",
        inspectionPoints: [
          { id: "w1", label: "Continuous undercut along top toe measuring >1.5mm in depth", isDefectOrCritical: true, explanation: "Deep undercut reduces cross-sectional wall thickness, creating a severe stress concentration notch prone to fatigue cracking." },
          { id: "w2", label: "Uniform weld bead reinforcement with 2mm crown height", isDefectOrCritical: false, explanation: "Meets standard AWS/BIS reinforcement specifications." },
          { id: "w3", label: "Scattered pinhole surface porosity cluster near weld crater", isDefectOrCritical: true, explanation: "Indicates gas entrapment from rapid arc extinguish or draft winds blowing shield gas." }
        ],
        correctActionEn: "Grind out the undercut and porosity areas with an angle grinder down to sound base metal, preheat to 100°C, and re-weld with baked E7018 electrode.",
        correctActionHi: "ग्राइंडर से डिफेक्ट वाले हिस्से को साफ करें और ओवन में सूखे 7018 इलेक्ट्रोड से दोबारा वेल्डिंग करें।"
      }
    ],
    bridgeModules: [
      {
        nosCode: "CSC/N0205",
        title: "12-Hour Micro-Bridge: MMAW Defect Rectification & Arc Speed Control",
        titleHindi: "१२ घंटे का ब्रिज कोर्स: वेल्डिंग दोष सुधार और आर्क नियंत्रण",
        hoursRequired: 12,
        learningOutcomes: [
          "Eliminate undercut through correct electrode angle (75 degrees) and side dwell",
          "Maintain uniform arc length (2-3mm) preventing spatter and porosity",
          "Apply multi-pass inter-run slag chipping technique"
        ],
        practicalChecklist: [
          "Fillet weld break test inspection",
          "Fillet weld gauge measurement",
          "Oven temperature logging and electrode holding"
        ],
        audioGuideAvailable: true
      }
    ]
  }
};
