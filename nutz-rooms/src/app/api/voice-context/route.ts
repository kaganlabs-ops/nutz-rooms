import { NextRequest } from "next/server";
import { searchGraph, KAGAN_USER_ID } from "@/lib/zep";

// API endpoint to fetch Zep context for voice calls
export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    // Search Kagan's knowledge graph for relevant facts
    // Use a general query if none provided
    const searchQuery = query || "Who is Kagan? What are his beliefs and background?";

    console.log("Fetching voice context for query:", searchQuery);

    const searchResults = await searchGraph(KAGAN_USER_ID, searchQuery);

    let context = "";
    if (searchResults && searchResults.edges && searchResults.edges.length > 0) {
      const facts = searchResults.edges
        .map((edge: { fact?: string }) => edge.fact)
        .filter(Boolean)
        .slice(0, 15); // Get top 15 most relevant facts

      if (facts.length > 0) {
        context = facts.join("\n");
        console.log("Found", facts.length, "facts for voice context");
      }
    }

    return Response.json({ context });
  } catch (error) {
    console.error("Voice context error:", error);
    return Response.json({ context: "" });
  }
}
