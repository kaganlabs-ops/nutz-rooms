import { ZepClient } from "@getzep/zep-cloud";

// Initialize Zep client
export const zep = new ZepClient({
  apiKey: process.env.ZEP_API_KEY!,
});

// Kagan's user ID in Zep
export const KAGAN_USER_ID = "kagan-sumer";

// Create or get user
export async function ensureUser(userId: string, firstName?: string, lastName?: string) {
  try {
    const user = await zep.user.get(userId);
    return user;
  } catch {
    // User doesn't exist, create them
    const user = await zep.user.add({
      userId,
      firstName,
      lastName,
    });
    return user;
  }
}

// Create a new conversation thread
export async function createThread(userId: string) {
  const threadId = `thread-${userId}-${Date.now()}`;
  await zep.thread.create({
    threadId,
    userId,
  });
  return threadId;
}

// Add messages to thread
export async function addMessages(
  threadId: string,
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    name?: string;
  }>
) {
  await zep.thread.addMessages(threadId, {
    messages: messages.map((m) => ({
      content: m.content,
      role: m.role === "user" ? "user" : m.role === "assistant" ? "assistant" : "norole",
      roleName: m.name,
    })),
  });
}

// Get messages from thread
export async function getThreadMessages(threadId: string) {
  try {
    const response = await zep.thread.get(threadId, {});
    return response.messages || [];
  } catch {
    return [];
  }
}

// Get user context for a thread (includes knowledge graph facts)
export async function getUserContext(threadId: string) {
  try {
    const context = await zep.thread.getUserContext(threadId, {});
    return context;
  } catch {
    return null;
  }
}

// Search the knowledge graph
export async function searchGraph(userId: string, query: string) {
  console.log(`[ZEP] searchGraph called - userId: ${userId}, query: "${query.slice(0, 50)}..."`);
  try {
    const results = await zep.graph.search({
      userId,
      query,
      limit: 10,
    });
    console.log(`[ZEP] searchGraph results:`, {
      edgeCount: results?.edges?.length || 0,
      facts: results?.edges?.slice(0, 3).map(e => e.fact?.slice(0, 50)) || []
    });
    return results;
  } catch (e) {
    console.error(`[ZEP] searchGraph ERROR:`, e);
    return null;
  }
}

// Add data to the knowledge graph
export async function addToGraph(userId: string, data: string, type: "text" | "json" = "text") {
  console.log(`[ZEP] addToGraph called - userId: ${userId}, type: ${type}, data: "${data.slice(0, 100)}..."`);
  try {
    await zep.graph.add({
      userId,
      type,
      data,
    });
    console.log(`[ZEP] addToGraph SUCCESS`);
    return true;
  } catch (e) {
    console.error("[ZEP] addToGraph FAILED:", e);
    return false;
  }
}

// ============================================
// USER MEMORY SYSTEM (per-user, separate from Kagan's brain)
// ============================================

// Get user's personal memory/context
// Does THREE things: graph search (broad + specific) AND retrieves user facts directly
export async function getUserMemory(userId: string, query: string, limit: number = 5): Promise<string[]> {
  console.log(`[ZEP] getUserMemory called - userId: ${userId}, query: "${query.slice(0, 50)}..."`);
  try {
    // Parallel fetch: broad search + query search + user facts
    const [broadResults, queryResults, userFacts] = await Promise.all([
      // 1. Broad search: who is this user, what are they working on
      zep.graph.search({
        userId,
        query: "user is building working on project startup app name challenge",
        limit: Math.ceil(limit / 2),
      }).catch(e => { console.log('[ZEP] broad search failed:', e); return null; }),
      // 2. Specific search: based on their current message
      zep.graph.search({
        userId,
        query,
        limit: Math.ceil(limit / 2),
      }).catch(e => { console.log('[ZEP] query search failed:', e); return null; }),
      // 3. Try to get user's stored facts directly (if API supports)
      zep.graph.search({
        userId,
        query: "User is User's User has User works User founded User mentioned",
        limit: limit,
      }).catch(e => { console.log('[ZEP] user facts search failed:', e); return null; }),
    ]);

    // Combine and dedupe
    const allFacts = new Set<string>();

    // Add facts from graph searches
    broadResults?.edges?.forEach((edge: { fact?: string }) => {
      if (edge.fact) allFacts.add(edge.fact);
    });

    queryResults?.edges?.forEach((edge: { fact?: string }) => {
      if (edge.fact) allFacts.add(edge.fact);
    });

    // Add user-specific facts (these should match "User is building X" format)
    userFacts?.edges?.forEach((edge: { fact?: string }) => {
      if (edge.fact && edge.fact.toLowerCase().startsWith('user')) {
        allFacts.add(edge.fact);
      }
    });

    const memories = Array.from(allFacts);
    console.log(`[ZEP] getUserMemory found ${memories.length} memories (${broadResults?.edges?.length || 0} broad + ${queryResults?.edges?.length || 0} query + ${userFacts?.edges?.length || 0} user facts, deduped)`);
    return memories;
  } catch (e) {
    console.error(`[ZEP] getUserMemory ERROR:`, e);
    return [];
  }
}

// Save fact to user's personal memory (NOT Kagan's brain)
export async function saveUserMemory(userId: string, fact: string): Promise<boolean> {
  console.log(`[ZEP] saveUserMemory - userId: ${userId}, fact: "${fact.slice(0, 100)}..."`);
  try {
    await zep.graph.add({
      userId,
      type: "text",
      data: fact,
    });
    console.log(`[ZEP] saveUserMemory SUCCESS`);
    return true;
  } catch (e) {
    console.error(`[ZEP] saveUserMemory FAILED:`, e);
    return false;
  }
}

// Format user memories for inclusion in prompt
export function formatUserMemoryContext(memories: string[]): string {
  if (memories.length === 0) return "";

  // Filter out noise (mode_state, timestamps, meta stuff)
  const cleanMemories = memories.filter(m => {
    const lower = m.toLowerCase();
    // Skip meta/system noise
    if (lower.includes('mode_state') || lower.includes('mode state')) return false;
    if (lower.includes('last updated at')) return false;
    if (lower.includes('current stage')) return false;
    if (lower.includes('started at')) return false;
    if (lower.includes('the assistant')) return false;
    return true;
  });

  if (cleanMemories.length === 0) return "";

  return `## RETURNING USER - What I remember about them:
${cleanMemories.map(m => `- ${m}`).join('\n')}

## HOW TO GREET RETURNING USERS

CRITICAL: Do NOT ask "what are u working on" if u have memory context above.

Instead, reference what u know:
- "yo hows the [their project] going"
- "did u talk to those users yet"
- "any progress on [thing they mentioned]"
- "last time u were stuck on X, figure it out?"

If they just say "hey" or "yo", acknowledge u know them briefly then ask about their stuff:
- "yo! hows the freelancer app"
- "hey whats up, how'd the launch go"

Only ask "what are u working on" if theres literally nothing in memory.

Weave memory in naturally. Dont say "I remember you said..." - just reference it like u naturally recall.`;
}

