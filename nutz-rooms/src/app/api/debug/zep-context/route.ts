import { NextRequest, NextResponse } from "next/server";
import { ensureUser, createThread, addMessages, getUserContext } from "@/lib/zep";

// Debug endpoint to test what Zep returns for getUserContext
// GET /api/debug/zep-context?userId=xxx&threadId=xxx
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const userId = searchParams.get("userId") || "test-debug-user";
  const existingThreadId = searchParams.get("threadId");

  try {
    // Ensure user exists
    await ensureUser(userId);

    // Get or create thread
    let threadId = existingThreadId;
    if (!threadId) {
      threadId = await createThread(userId);
      // Add a test message so Zep has something to work with
      await addMessages(threadId, [
        { role: "user", content: "hey whats up", name: "User" },
      ]);
    }

    // Get memory context - this is the KEY call
    const memoryContext = await getUserContext(threadId);

    return NextResponse.json({
      status: "ok",
      userId,
      threadId,
      memoryContext: {
        raw: memoryContext,
        length: memoryContext?.length || 0,
        hasContent: !!(memoryContext && memoryContext.trim() && memoryContext.length > 50),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Debug zep-context error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        userId,
      },
      { status: 500 }
    );
  }
}
