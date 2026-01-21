import { NextRequest } from "next/server";
import { searchGraph, KAGAN_USER_ID, getUserMemoryFromThread, getThreadMessages } from "@/lib/zep";

// API endpoint to fetch context for voice calls (display purposes)
// Note: The actual LLM (voice-llm) fetches user memory separately during conversation
export async function POST(req: NextRequest) {
  try {
    const { query, userId, lastSessionThreadId } = await req.json();

    // Search Kagan's knowledge graph for relevant facts (his personality)
    const searchQuery = query || "Who is Kagan? What are his beliefs and background?";

    console.log(`[VOICE-CTX] Query: "${searchQuery}", userId: ${userId}`);

    // Get Kagan's facts (for personality display)
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

    // Get user memory (for display in dev tools)
    // Note: voice-llm will fetch this again during actual conversation
    let userMemory = "";
    if (userId) {
      try {
        const threadContext = await getUserMemoryFromThread(userId);
        if (threadContext && threadContext.length > 50) {
          userMemory = threadContext;
          console.log(`[VOICE-CTX] Got user context: ${threadContext.length} chars`);
        } else {
          console.log(`[VOICE-CTX] No user memory found for ${userId}`);
        }
      } catch (e) {
        console.error(`[VOICE-CTX] Error getting user memory:`, e);
      }
    }

    // Get last conversation from previous session thread
    let lastConversation = "";
    if (lastSessionThreadId) {
      try {
        const messages = await getThreadMessages(lastSessionThreadId, 20);
        if (messages && messages.length > 0) {
          const formatted = messages
            .map((msg: { role: string; content: string }) =>
              `${msg.role === 'user' ? 'User' : 'Kagan'}: ${msg.content}`
            )
            .join('\n');
          lastConversation = formatted;
          console.log(`[VOICE-CTX] Got ${messages.length} messages from last session`);
        }
      } catch (e) {
        console.error(`[VOICE-CTX] Error getting last conversation:`, e);
      }
    }

    // Combine context for display
    let context = "";
    if (kaganFacts) {
      context += `KAGAN'S BACKGROUND:\n${kaganFacts}`;
    }
    if (lastConversation) {
      context += `\n\nLAST CONVERSATION:\n${lastConversation}`;
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
