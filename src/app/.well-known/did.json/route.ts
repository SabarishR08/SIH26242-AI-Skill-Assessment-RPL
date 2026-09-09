import { getDidDocument } from "@/lib/passport-crypto";
import { json } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "pathfinder-ai-61aq.onrender.com";
  const doc = getDidDocument(host);
  return json(doc, {
    status: 200,
    headers: {
      "content-type": "application/did+ld+json; charset=utf-8",
    },
  });
}
