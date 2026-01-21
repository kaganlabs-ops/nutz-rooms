import { ZepClient } from "@getzep/zep-cloud";

// Initialize Zep client
export const zep = new ZepClient({
  apiKey: process.env.ZEP_API_KEY!,
});

// Kagan's user ID in Zep (for his personality/brain facts)
export const KAGAN_USER_ID = "kagan-sumer";

// Fact rating instruction for new users
const FACT_RATING_INSTRUCTION = `Rate facts by relevance to helping this user with startup/business problems.
High priority = their current project, goals, blockers, what they're building
Medium priority = background info, preferences, past experience
Low priority = casual mentions, small talk details`;

// ============================================
// USER MANAGEMENT
// ============================================

// Ensure user exists in Zep (create if not found)
export async function ensureUser(userId: string, firstName?: string, lastName?: string) {
  console.log(`[ZEP] ensureUser called - userId: ${userId}`);
  try {
    const user = await zep.user.get(userId);
    console.log(`[ZEP] User exists: ${userId}`);
    return user;
  } catch {
    // User doesn't exist, create them with fact rating instruction
    console.log(`[ZEP] Creating new user: ${userId}`);
    const user = await zep.user.add({
      userId,
      firstName,
      lastName,
      metadata: {
        factRatingInstruction: FACT_RATING_INSTRUCTION,
      },
    });
    console.log(`[ZEP] User created: ${userId}`);
    return user;
  }
}

// ============================================
// THREAD MANAGEMENT
// ============================================

// Create a new thread for a session (each session = new thread)
export async function createThread(userId: string, sessionId?: string) {
  const threadId = sessionId || `thread-${userId}-${Date.now()}`;
  console.log(`[ZEP] Creating thread: ${threadId} for user: ${userId}`);

  await zep.thread.create({
    threadId,
    userId,
  });

  console.log(`[ZEP] Thread created: ${threadId}`);
  return threadId;
}

// Get user's most recent thread ID
export async function getUserLatestThread(userId: string): Promise<string | null> {
  console.log(`[ZEP] getUserLatestThread - userId: ${userId}`);
  try {
    const threads = await zep.thread.listAll({
      pageSize: 20,
    });

    // Filter to this user's threads and sort by most recent
    const userThreads = threads.threads
      ?.filter(t => t.userId === userId)
      ?.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

    if (userThreads && userThreads.length > 0) {
      console.log(`[ZEP] Found ${userThreads.length} threads, latest: ${userThreads[0].threadId}`);
      return userThreads[0].threadId || null;
    }

    console.log(`[ZEP] No threads found for user ${userId}`);
    return null;
  } catch (e) {
    console.error(`[ZEP] getUserLatestThread ERROR:`, e);
    return null;
  }
}

// ============================================
// MESSAGE MANAGEMENT
// ============================================

// Add messages to thread (Zep auto-extracts facts from these)
export async function addMessages(
  threadId: string,
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    name?: string;
  }>
) {
  console.log(`[ZEP] addMessages - threadId: ${threadId}, count: ${messages.length}`);

  await zep.thread.addMessages(threadId, {
    messages: messages.map((m) => ({
      content: m.content,
      role: m.role === "user" ? "user" : m.role === "assistant" ? "assistant" : "norole",
      roleName: m.name,
    })),
  });

  console.log(`[ZEP] Messages added to thread ${threadId}`);
}

// Get messages from a specific thread (for "last session" context)
export async function getThreadMessages(threadId: string, limit: number = 10) {
  console.log(`[ZEP] getThreadMessages - threadId: ${threadId}, limit: ${limit}`);
  try {
    const response = await zep.thread.get(threadId, {});
    const messages = response.messages || [];
    console.log(`[ZEP] Got ${messages.length} messages from thread`);
    return messages.slice(-limit);
  } catch (e) {
    console.error(`[ZEP] getThreadMessages ERROR:`, e);
    return [];
  }
}

// ============================================
// CONTEXT RETRIEVAL (THE KEY PART!)
// ============================================

// Get user context from thread - searches ENTIRE user graph across ALL sessions
// This is the primary way to get memory - returns pre-formatted context block
export async function getUserContext(threadId: string): Promise<string | null> {
  console.log(`[ZEP] getUserContext - threadId: ${threadId}`);
  try {
    const response = await zep.thread.getUserContext(threadId, {});
    const context = response.context || '';

    console.log(`[ZEP] getUserContext returned ${context.length} chars`);
    if (context.length > 0) {
      console.log(`[ZEP] Context preview: ${context.slice(0, 200)}...`);
    }

    return context || null;
  } catch (e) {
    console.error(`[ZEP] getUserContext ERROR:`, e);
    return null;
  }
}

// Get user memory from their most recent thread
// Useful when you don't have a current thread yet
export async function getUserMemoryFromThread(userId: string): Promise<string | null> {
  console.log(`[ZEP] getUserMemoryFromThread - userId: ${userId}`);

  const threadId = await getUserLatestThread(userId);
  if (!threadId) {
    console.log(`[ZEP] No thread found for user`);
    return null;
  }

  return await getUserContext(threadId);
}

// ============================================
// GRAPH SEARCH (LOWER LEVEL)
// ============================================

// Search the knowledge graph directly (useful for specific queries)
export async function searchGraph(userId: string, query: string, limit: number = 10) {
  console.log(`[ZEP] searchGraph - userId: ${userId}, query: "${query.slice(0, 50)}..."`);
  try {
    const results = await zep.graph.search({
      userId,
      query,
      limit,
    });

    const facts = results?.edges?.map(e => e.fact).filter(Boolean) || [];
    console.log(`[ZEP] searchGraph found ${facts.length} facts`);

    return results;
  } catch (e) {
    console.error(`[ZEP] searchGraph ERROR:`, e);
    return null;
  }
}

// Get user memory via graph search (fallback method)
export async function getUserMemory(userId: string, query: string, limit: number = 5): Promise<string[]> {
  console.log(`[ZEP] getUserMemory - userId: ${userId}, query: "${query.slice(0, 50)}..."`);
  try {
    const results = await zep.graph.search({
      userId,
      query,
      limit,
    });

    const facts = results?.edges?.map(e => e.fact).filter(Boolean) as string[] || [];
    console.log(`[ZEP] getUserMemory found ${facts.length} facts`);
    return facts;
  } catch (e) {
    console.error(`[ZEP] getUserMemory ERROR:`, e);
    return [];
  }
}

// Add data directly to the knowledge graph
export async function addToGraph(userId: string, data: string, type: "text" | "json" = "text") {
  console.log(`[ZEP] addToGraph - userId: ${userId}, type: ${type}`);
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
// FORMATTING HELPERS
// ============================================

// Format user memories for prompt injection
export function formatUserMemoryContext(memories: string[]): string {
  if (memories.length === 0) return "";

  // Filter out noise
  const cleanMemories = memories.filter(m => {
    const lower = m.toLowerCase();
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

// Format thread messages as "last session" context
export function formatLastSessionMessages(messages: Array<{ role?: string; content?: string }>): string {
  if (!messages || messages.length === 0) return "";

  const formatted = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? 'User' : 'Kagan'}: ${m.content}`)
    .join('\n');

  return `## LAST SESSION RECAP:
${formatted}`;
}

// Check if context has real content (not just template text)
export function hasRealMemory(context: string | null): boolean {
  if (!context || context.length < 50) return false;

  // Check for actual USER_SUMMARY content
  const hasUserSummary = context.includes('<USER_SUMMARY>') &&
    !context.includes('No other personal or lifestyle details are currently known') &&
    !context.includes('No other personal or lifestyle details are available');

  // Check for non-empty FACTS section
  const hasRealFacts = context.includes('<FACTS>') &&
    !context.match(/<FACTS>\s*<\/FACTS>/) &&
    !context.match(/<FACTS>\s*\n\s*<\/FACTS>/);

  return hasUserSummary || hasRealFacts;
}
