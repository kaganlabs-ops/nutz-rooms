import { NextRequest } from "next/server";
import { searchGraph, KAGAN_USER_ID, getUserMemoryFromThread, getThreadMessages } from "@/lib/zep";
import { Commitment, formatDeadlineDisplay, isOverdue, isDueSoon } from "@/lib/commitments";
import fs from "fs/promises";
import path from "path";

// How many messages to fetch per thread
const MESSAGES_PER_THREAD = 30;
// How many recent threads to fetch from
const MAX_THREADS_TO_FETCH = 3;

// Build commitment context with better formatting for Kagan to check in
function buildCommitmentContextForVoice(commitments: Commitment[]): string {
  if (!commitments || commitments.length === 0) return '';

  const active = commitments.filter(c => c.status === 'active');
  if (active.length === 0) return '';

  const overdue = active.filter(c => isOverdue(c));
  const dueSoon = active.filter(c => isDueSoon(c) && !isOverdue(c));
  const others = active.filter(c => !isOverdue(c) && !isDueSoon(c));

  let context = 'USER\'S ACTIVE COMMITMENTS (check in on these!):\n';

  // Overdue first - most important
  if (overdue.length > 0) {
    context += '\n⚠️ OVERDUE (ask what happened):\n';
    for (const c of overdue) {
      const progressStr = c.progress ? ` (${c.progress.done}/${c.progress.total})` : '';
      context += `- "${c.commitment}"${progressStr} was due ${formatDeadlineDisplay(c)}\n`;
    }
  }

  // Due soon
  if (dueSoon.length > 0) {
    context += '\n📅 DUE SOON (check progress):\n';
    for (const c of dueSoon) {
      const progressStr = c.progress ? ` (${c.progress.done}/${c.progress.total})` : '';
      context += `- "${c.commitment}"${progressStr} · Due ${formatDeadlineDisplay(c)}\n`;
    }
  }

  // Others
  if (others.length > 0) {
    context += '\n📋 UPCOMING:\n';
    for (const c of others) {
      const progressStr = c.progress ? ` (${c.progress.done}/${c.progress.total})` : '';
      context += `- "${c.commitment}"${progressStr} · Due ${formatDeadlineDisplay(c)}\n`;
    }
  }

  context += '\nIMPORTANT: Start by checking in on these commitments! Ask "did you get that done?" or "how\'s that going?"';

  return context;
}

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

    // Get user's active commitments from the API storage location
    let commitmentsContext = "";
    if (userId) {
      try {
        // Try .data/commitments.json first (where API stores them)
        const apiStorageFile = path.join(process.cwd(), ".data", "commitments.json");
        let allCommitments: Record<string, Commitment[]> = {};

        try {
          const data = await fs.readFile(apiStorageFile, "utf-8");
          allCommitments = JSON.parse(data);
        } catch {
          // Try legacy location as fallback
          const legacyFile = path.join(process.cwd(), "data", "commitments.json");
          try {
            const data = await fs.readFile(legacyFile, "utf-8");
            // Legacy format might be array, not object
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              // Convert array format to object format
              allCommitments = {};
              for (const c of parsed) {
                if (!allCommitments[c.userId]) allCommitments[c.userId] = [];
                allCommitments[c.userId].push(c);
              }
            } else {
              allCommitments = parsed;
            }
          } catch {
            // No commitments file exists
          }
        }

        const userCommitments = allCommitments[userId] || [];
        const activeCommitments = userCommitments.filter(c => c.status === "active");

        if (activeCommitments.length > 0) {
          commitmentsContext = buildCommitmentContextForVoice(activeCommitments);
          console.log(`[VOICE-CTX] Found ${activeCommitments.length} active commitments for ${userId}`);
        } else {
          console.log(`[VOICE-CTX] No active commitments for ${userId}`);
        }
      } catch (e) {
        console.error(`[VOICE-CTX] Error reading commitments:`, e);
      }
    }

    // Combine context for display
    // IMPORTANT: Put commitments FIRST so Kagan sees them immediately and checks in
    let context = "";
    if (commitmentsContext) {
      context += commitmentsContext;
    }
    if (userMemory) {
      context += `\n\nWHAT I REMEMBER ABOUT THIS USER:\n${userMemory}`;
    }
    if (recentConversations) {
      context += `\n\nRECENT CONVERSATIONS:\n${recentConversations}`;
    }
    if (kaganFacts) {
      context += `\n\nKAGAN'S BACKGROUND:\n${kaganFacts}`;
    }

    console.log(`[VOICE-CTX] Returning context: ${context.length} chars`);
    return Response.json({ context });
  } catch (error) {
    console.error("Voice context error:", error);
    return Response.json({ context: "" });
  }
}
