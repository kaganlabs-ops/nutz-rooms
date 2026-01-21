import { NextRequest, NextResponse } from "next/server";
import { getUserMemory, KAGAN_USER_ID } from "@/lib/zep";
import { findRelevantFacts, getKaganBrain, getBrainStats } from "@/lib/brain";

// Debug endpoint to check memory status
// GET /api/debug/memory?userId=xxx&query=hello
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const userId = searchParams.get("userId") || KAGAN_USER_ID;
  const query = searchParams.get("query") || "hello";

  try {
    // Get brain stats
    const brainStats = getBrainStats();
    const brain = getKaganBrain();

    // Get relevant brain facts for query
    const relevantBrainFacts = findRelevantFacts(query, 5);

    // Get user memory
    const userMemories = await getUserMemory(userId, query, 10);

    return NextResponse.json({
      status: "ok",
      userId,
      query,
      brain: {
        loaded: brainStats.loaded,
        totalFacts: brainStats.factCount,
        relevantFacts: relevantBrainFacts,
        sampleFacts: brain.slice(0, 5),
      },
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
