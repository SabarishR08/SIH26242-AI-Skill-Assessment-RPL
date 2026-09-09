import { db } from "@/lib/db";
import { loadSkillGraph } from "@/lib/engine/data";
import { executeWithGroqPool } from "@/lib/ai/groq-pool";
import type { ExtractedProfile } from "./agent";

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
};

function extractHeuristics(history: Array<{ role: string; content: string }>, graph: any): ExtractedProfile {
  const profile: ExtractedProfile = {};
  const userTexts = history.filter((h) => h.role === "user").map((h) => h.content);
  const combined = userTexts.join(" ");

  // 1. Hours per week
  const hoursMatch = combined.match(/(?:^|\D)(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty)\s*(?:hours|hrs|h)(?:\s*(?:a|\/|per)\s*week)?/i);
  if (hoursMatch) {
    const raw = hoursMatch[1].toLowerCase();
    const val = parseInt(raw, 10) || WORD_NUMBERS[raw];
    if (val && val >= 1 && val <= 80) profile.hoursPerWeek = val;
  }

  // 2. Timeline in weeks (months or weeks)
  const monthsMatch = combined.match(/(?:^|\D)(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s*months?/i);
  if (monthsMatch) {
    const raw = monthsMatch[1].toLowerCase();
    const months = parseInt(raw, 10) || WORD_NUMBERS[raw];
    if (months && months > 0) profile.timelineWeeks = Math.round(months * 4.33);
  } else {
    const weeksMatch = combined.match(/(?:^|\D)(\d{1,2})\s*weeks?/i);
    if (weeksMatch) {
      const val = parseInt(weeksMatch[1], 10);
      if (val && val > 0) profile.timelineWeeks = val;
    }
  }

  // 3. Domain detection
  const lower = combined.toLowerCase();
  if (lower.includes("data science") || lower.includes("data scientist") || lower.includes("data analyst")) {
    profile.domain = "Data Science";
    profile.targetRole = "Data Scientist";
    profile.goalSkillId = "ds_datascience";
  } else if (lower.includes("machine learning") || lower.includes("deep learning") || lower.includes("ai engineer") || lower.includes("ml engineer")) {
    profile.domain = "Machine Learning & AI";
    profile.targetRole = "Machine Learning Engineer";
    profile.goalSkillId = "ml_ml";
  } else if (lower.includes("frontend") || lower.includes("front-end") || lower.includes("react") || lower.includes("next.js")) {
    profile.domain = "Web Development";
    profile.targetRole = "Frontend Developer";
    profile.goalSkillId = "react";
  } else if (lower.includes("full stack") || lower.includes("fullstack") || lower.includes("web dev") || lower.includes("web development")) {
    profile.domain = "Web Development";
    profile.targetRole = "Full Stack Developer";
    profile.goalSkillId = "next";
  } else if (lower.includes("devops") || lower.includes("cloud") || lower.includes("kubernetes") || lower.includes("docker")) {
    profile.domain = "DevOps & SRE";
    profile.targetRole = "DevOps Engineer";
    profile.goalSkillId = "devops_docker";
  } else if (lower.includes("mobile") || lower.includes("ios") || lower.includes("android") || lower.includes("flutter")) {
    profile.domain = "Mobile Development";
    profile.targetRole = "Mobile Developer";
    profile.goalSkillId = "mob_reactnative";
  }

  // 4. Specific goal skill ID match from skill graph (only if not already resolved)
  if (!profile.goalSkillId && graph?.skills) {
    for (const [id, s] of Object.entries<any>(graph.skills)) {
      const name = s.name.toLowerCase();
      if (name.length >= 4 && lower.includes(name)) {
        profile.goalSkillId = id;
        if (s.domain) profile.domain = s.domain;
        break;
      }
    }
  }

  // 5. Goal statement fallback
  if (userTexts.length > 0) {
    profile.goalStatement = userTexts.find((t) => t.length > 15 && !t.startsWith("/")) || userTexts[0];
  }

  return profile;
}

export async function extractProfile(learnerId: string): Promise<ExtractedProfile> {
  const state = await db.agentState.findUnique({ where: { learnerId } });
  if (!state) return {};
  const history = JSON.parse(state.historyJson || "[]");

  const graph = await loadSkillGraph();
  const heuristics = extractHeuristics(history, graph);

  const domains = graph.domains.join(", ");
  // Compact curriculum anchors (top goal skills instead of all 211 skills to keep tokens under 300)
  const curriculumAnchors = [
    "Data Science: ID 'ds_datascience' (Data Science), ID 'ds_python' (Python), ID 'ds_sql' (SQL)",
    "Machine Learning & AI: ID 'ml_ml' (Machine Learning), ID 'ml_dl' (Deep Learning), ID 'ml_nlp' (NLP)",
    "Web Development: ID 'next' (Next.js), ID 'react' (React), ID 'node' (Node.js), ID 'ts' (TypeScript)",
    "DevOps & SRE: ID 'devops_docker' (Docker), ID 'devops_k8s' (Kubernetes), ID 'cloud_aws' (AWS)",
    "Mobile Development: ID 'mob_reactnative' (React Native), ID 'mob_flutter' (Flutter)",
  ].join("\n");

  const systemPrompt = `You are an expert data extraction bot.
Review the conversation history and extract the following information about the user.
Available domains: ${domains}
Sample goal skill IDs:
${curriculumAnchors}

Output a JSON object ONLY with the following structure (omit keys if not known):
{
  "name": "string",
  "goalStatement": "string",
  "targetRole": "string",
  "domain": "string (MUST match one of the available domains)",
  "goalSkillId": "string (the exact ID of the primary skill they want to master, e.g. 'ds_datascience')",
  "hoursPerWeek": number,
  "timelineWeeks": number,
  "learningStyle": "string",
  "motivation": "string",
  "constraints": ["string"]
}`;

  const useGateway = Boolean(process.env.AI_GATEWAY_API_KEY);
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const baseUrl = process.env.GROQ_BASE_URL || (useGateway ? "https://ai-gateway.vercel.sh/v1" : "https://api.groq.com/openai/v1");

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-10).map((h: any) => ({ role: h.role, content: h.content })),
    { role: "user", content: "Extract the profile as JSON now. Respond with ONLY valid JSON." }
  ];

  let llmExtracted: ExtractedProfile = {};

  try {
    llmExtracted = await executeWithGroqPool(async (apiKey) => {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: useGateway ? `groq/${model}` : model,
          messages,
          temperature: 0.1,
          response_format: { type: "json_object" }
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq extraction HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) {
        return JSON.parse(content) as ExtractedProfile;
      }
      return {};
    });
  } catch (e) {
    console.warn("[ProfileExtraction] LLM extraction encountered error, falling back to heuristics:", e);
  }

  // Merge heuristics and LLM output so profile is never blank
  const merged: ExtractedProfile = {
    ...heuristics,
    ...llmExtracted,
  };

  // Guarantee required fallbacks if still null
  if (!merged.domain && heuristics.domain) merged.domain = heuristics.domain;
  if (!merged.goalSkillId && heuristics.goalSkillId) merged.goalSkillId = heuristics.goalSkillId;
  if (merged.goalSkillId) {
    if (merged.goalSkillId.includes("|")) {
      merged.goalSkillId = merged.goalSkillId.split("|")[0].trim();
    }
    merged.goalSkillId = merged.goalSkillId.replace(/\s*\([^)]*\)/, "").trim();
  }
  if (!merged.targetRole && heuristics.targetRole) merged.targetRole = heuristics.targetRole;
  if (!merged.hoursPerWeek && heuristics.hoursPerWeek) merged.hoursPerWeek = heuristics.hoursPerWeek;
  if (!merged.timelineWeeks && heuristics.timelineWeeks) merged.timelineWeeks = heuristics.timelineWeeks;
  if (!merged.goalStatement && heuristics.goalStatement) merged.goalStatement = heuristics.goalStatement;

  return merged;
}
