import { NextRequest, NextResponse } from "next/server";
import { saveUserMemory, getUserMemory, ensureUser } from "@/lib/zep";

// Debug endpoint to test save + retrieve
// GET /api/debug/test-save?userId=xxx
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const userId = searchParams.get("userId") || "debug-test-user";

  try {
    // Ensure user exists
    await ensureUser(userId);

    // 1. Get current memories
    const beforeMemories = await getUserMemory(userId, "what is the user building", 10);

    // 2. Save a test fact with timestamp
    const testFact = `User is building: Debug Test App ${Date.now()}`;
    const saveResult = await saveUserMemory(userId, testFact);

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
      note: "If afterCount equals beforeCount, Zep has indexing delay. Try again in 10-30 seconds.",
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
