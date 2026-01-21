import { NextRequest, NextResponse } from "next/server";
import { getUserMemory, ensureUser, zep } from "@/lib/zep";

// Debug endpoint to check what facts exist for a user
// GET /api/debug/user-facts?userId=xxx
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    // Ensure user exists
    await ensureUser(userId);

    // Try multiple searches to find any facts
    const searches = await Promise.all([
      getUserMemory(userId, "rugby sport", 10),
      getUserMemory(userId, "user is building working on", 10),
      getUserMemory(userId, "water polo", 10),
      getUserMemory(userId, "training", 10),
    ]);

    // Also try raw graph search
    let rawGraphResults = null;
    try {
      rawGraphResults = await zep.graph.search({
        userId,
        query: "user",
        limit: 20,
      });
    } catch (e) {
      console.error("Raw graph search failed:", e);
    }

    // Get all threads for this user
    let userThreads: Array<{ id: string | undefined; created: string | Date | undefined }> = [];
    try {
      const threadsResponse = await zep.thread.listAll({
        pageSize: 10,
      });
      // Filter to this user's threads
      const allThreads = threadsResponse.threads || [];
      userThreads = allThreads
        .filter(t => t.userId === userId)
        .map(t => ({ id: t.threadId, created: t.createdAt }));
    } catch (e) {
      console.error("Thread list failed:", e);
    }

    return NextResponse.json({
      status: "ok",
      userId,
      searches: {
        rugby: searches[0],
        building: searches[1],
        waterPolo: searches[2],
        training: searches[3],
      },
      rawGraphFacts: rawGraphResults?.edges?.map(e => e.fact).slice(0, 10) || [],
      rawGraphCount: rawGraphResults?.edges?.length || 0,
      userThreads,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Debug user-facts error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      },
      { status: 500 }
    );
  }
}
