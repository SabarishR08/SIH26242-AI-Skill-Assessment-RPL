import { db } from "@/lib/db";
import { loadSkillGraph } from "@/lib/engine/data";
import { z } from "zod";
import type { ExtractedProfile } from "./agent";

export async function extractProfile(learnerId: string): Promise<ExtractedProfile> {
  const state = await db.agentState.findUnique({ where: { learnerId } });
  if (!state) return {};
  const history = JSON.parse(state.historyJson || "[]");
  
  const graph = await loadSkillGraph();
  const domains = graph.domains.join(", ");
  const compactSkills = Object.values(graph.skills).map((s) => `${s.id}|${s.name}`).join(", ");
  
  const systemPrompt = `You are an expert data extraction bot.
Review the conversation history and extract the following information about the user.
Available domains: ${domains}
Available skills (id|name): ${compactSkills}

Output a JSON object ONLY with the following structure (omit keys if not known):
{
  "name": "string",
  "goalStatement": "string",
  "targetRole": "string",
  "domain": "string (MUST be one of the available domains if known)",
  "goalSkillId": "string (the primary skill ID they want to master, if known)",
  "hoursPerWeek": number,
  "learningStyle": "string",
  "motivation": "string",
  "constraints": ["string"]
}`;

  const useGateway = Boolean(process.env.AI_GATEWAY_API_KEY);
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const baseUrl = process.env.GROQ_BASE_URL || (useGateway ? "https://ai-gateway.vercel.sh/v1" : "https://api.groq.com/openai/v1");
  const authToken = useGateway ? process.env.AI_GATEWAY_API_KEY : process.env.GROQ_API_KEY;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-14).map((h: any) => ({ role: h.role, content: h.content })),
    { role: "user", content: "Extract the profile as JSON now. Respond with ONLY valid JSON." }
  ];

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ["Bearer", authToken ?? ""].join(" "),
      },
      body: JSON.stringify({
        model: useGateway ? `groq/${model}` : model,
        messages,
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });
    
    if (!response.ok) return {};
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (content) {
      return JSON.parse(content) as ExtractedProfile;
    }
  } catch (e) {
    console.error("Extraction failed", e);
  }
  return {};
}
