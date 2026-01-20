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

