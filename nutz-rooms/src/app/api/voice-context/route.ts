import { NextRequest } from "next/server";
import { searchGraph, KAGAN_USER_ID, getUserMemory, getUserMemoryFromThread } from "@/lib/zep";

// API endpoint to fetch Zep context for voice calls
// Returns: Kagan's personality/facts + user's personal memory
export async function POST(req: NextRequest) {
  try {
    const { query, userId } = await req.json();

    // Search Kagan's knowledge graph for relevant facts (his personality)
    const searchQuery = query || "Who is Kagan? What are his beliefs and background?";

    console.log(`[VOICE-CTX] Query: "${searchQuery}", userId: ${userId}`);

    // Get Kagan's facts (for personality)
    const searchResults = await searchGraph(KAGAN_USER_ID, searchQuery);

    let kaganFacts = "";
    if (searchResults && searchResults.edges && searchResults.edges.length > 0) {
      const facts = searchResults.edges
        .map((edge: { fact?: string }) => edge.fact)
        .filter(Boolean)
        .slice(0, 10);

      if (facts.length > 0) {
        kaganFacts = facts.join("\n");
        console.log(`[VOICE-CTX] Found ${facts.length} Kagan facts`);
      }
    }

    // Get USER's memory - try thread-based first, then fall back to graph search
    let userMemory = "";
    if (userId) {
      try {
        // Try 1: Get context from user's most recent thread
        // This is more reliable than graph.search because it doesn't need indexing
        const threadContext = await getUserMemoryFromThread(userId);

        if (threadContext && threadContext.length > 50) {
          userMemory = threadContext;
          console.log(`[VOICE-CTX] Got user context from thread: ${threadContext.length} chars`);
        } else {
          // Try 2: Fall back to graph search (for indexed facts)
          const userFacts = await getUserMemory(userId, "user project building working on", 15);

          if (userFacts.length > 0) {
            userMemory = userFacts.join("\n");
            console.log(`[VOICE-CTX] Found ${userFacts.length} user facts from graph`);
          } else {
            console.log(`[VOICE-CTX] No user memory found for ${userId}`);
          }
        }
      } catch (e) {
        console.error(`[VOICE-CTX] Error getting user memory:`, e);
      }
    }

    // Combine context
    let context = "";
    if (kaganFacts) {
      context += `KAGAN'S BACKGROUND:\n${kaganFacts}`;
    }
    if (userMemory) {
      context += `\n\nWHAT I REMEMBER ABOUT THIS USER:\n${userMemory}`;
    }

    console.log(`[VOICE-CTX] Returning context: ${context.length} chars`);
    return Response.json({ context });
  } catch (error) {
    console.error("Voice context error:", error);
    return Response.json({ context: "" });
  }
}
