import { skillSearch } from "@/lib/engine";
import { apiError, handleApiError, json } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/** Search the pre-configured skills catalogue. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("query") || "";
    const domain = url.searchParams.get("domain") || null;
    const hits = await skillSearch(query, domain);
    return json({ hits });
  } catch (e) {
    return handleApiError(e, "Failed to search skills");
  }
}
