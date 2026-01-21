import { NextRequest } from "next/server";
import { searchGraph, KAGAN_USER_ID, getUserMemoryFromThread, getThreadMessages } from "@/lib/zep";

// How many messages to fetch per thread
const MESSAGES_PER_THREAD = 30;
// How many recent threads to fetch from
const MAX_THREADS_TO_FETCH = 3;

// API endpoint to fetch context for voice calls (display purposes)
// Note: The actual LLM (voice-llm) fetches user memory separately during conversation
export async function POST(req: NextRequest) {
  try {
    const { query, userId, lastSessionThreadId, recentThreadIds } = await req.json();

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

    // Get conversations from recent session threads
    let recentConversations = "";

    // Use recentThreadIds if available, otherwise fall back to lastSessionThreadId
    const threadIdsToFetch: string[] = [];
    if (recentThreadIds && Array.isArray(recentThreadIds) && recentThreadIds.length > 0) {
      threadIdsToFetch.push(...recentThreadIds.slice(0, MAX_THREADS_TO_FETCH));
    } else if (lastSessionThreadId) {
      threadIdsToFetch.push(lastSessionThreadId);
    }

    if (threadIdsToFetch.length > 0) {
      console.log(`[VOICE-CTX] Fetching from ${threadIdsToFetch.length} threads`);

      const conversationParts: string[] = [];

      for (let i = 0; i < threadIdsToFetch.length; i++) {
        const threadId = threadIdsToFetch[i];
        try {
          const messages = await getThreadMessages(threadId, MESSAGES_PER_THREAD);
          if (messages && messages.length > 0) {
            const formatted = messages
              .map((msg: { role: string; content: string }) =>
                `${msg.role === 'user' ? 'User' : 'Kagan'}: ${msg.content}`
              )
              .join('\n');

            // Label each session (most recent = Session 1)
            const sessionLabel = i === 0 ? "LAST SESSION" : `SESSION ${i + 1} AGO`;
            conversationParts.push(`--- ${sessionLabel} (${messages.length} messages) ---\n${formatted}`);
            console.log(`[VOICE-CTX] Got ${messages.length} messages from thread ${i + 1}`);
          }
        } catch (e) {
          console.error(`[VOICE-CTX] Error getting conversation from thread ${threadId}:`, e);
        }
      }

      if (conversationParts.length > 0) {
        recentConversations = conversationParts.join('\n\n');
      }
    }

    // Combine context for display
    let context = "";
    if (kaganFacts) {
      context += `KAGAN'S BACKGROUND:\n${kaganFacts}`;
    }
    if (recentConversations) {
      context += `\n\nRECENT CONVERSATIONS:\n${recentConversations}`;
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
