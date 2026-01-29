import { NextRequest, NextResponse } from "next/server";
import { getUserMemory, KAGAN_USER_ID } from "@/lib/zep";

// Debug endpoint to check memory status
// GET /api/debug/memory?userId=xxx&query=hello
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const userId = searchParams.get("userId") || KAGAN_USER_ID;
  const query = searchParams.get("query") || "hello";

  try {
    // Get user memory from Zep
    const userMemories = await getUserMemory(userId, query, 10);

    return NextResponse.json({
      status: "ok",
      userId,
      query,
      userMemory: {
        count: userMemories.length,
        memories: userMemories,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Debug memory error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
        query,
      },
      { status: 500 }
    );
  }
}
