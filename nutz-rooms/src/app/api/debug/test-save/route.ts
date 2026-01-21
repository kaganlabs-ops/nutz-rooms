import { NextRequest, NextResponse } from "next/server";
import { getUserMemory, ensureUser, addToGraph } from "@/lib/zep";

// Debug endpoint to test save + retrieve
// GET /api/debug/test-save?userId=xxx
// NOTE: Zep auto-extracts facts from thread messages. This endpoint tests
// the low-level graph.add() API which has indexing delay (~10-30 seconds).
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const userId = searchParams.get("userId") || "debug-test-user";

  try {
    // Ensure user exists
    await ensureUser(userId);

    // 1. Get current memories
    const beforeMemories = await getUserMemory(userId, "what is the user building", 10);

    // 2. Save a test fact with timestamp using graph.add (low-level API)
    const testFact = `User is building: Debug Test App ${Date.now()}`;
    const saveResult = await addToGraph(userId, testFact, "text");

    // 3. Immediately try to retrieve (usually won't find it - indexing delay)
    const afterMemories = await getUserMemory(userId, "what is the user building", 10);

    // 4. Search specifically for the test fact
    const searchResult = await getUserMemory(userId, "Debug Test App", 10);

    return NextResponse.json({
      status: "ok",
      userId,
      testFact,
      saveResult,
      beforeCount: beforeMemories.length,
      afterCount: afterMemories.length,
      searchCount: searchResult.length,
      note: "graph.add has indexing delay (~10-30 seconds). For chat messages, use thread.addMessages instead - Zep auto-extracts facts.",
      beforeMemories: beforeMemories.slice(0, 5),
      afterMemories: afterMemories.slice(0, 5),
      searchResult: searchResult.slice(0, 5),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Debug test-save error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      },
      { status: 500 }
    );
  }
}
