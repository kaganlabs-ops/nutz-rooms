import { NextRequest } from "next/server";
import { searchGraph, KAGAN_USER_ID } from "@/lib/zep";

// CORS headers for ElevenLabs webhook
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Recall memories from Zep knowledge graph
// ElevenLabs will call this as a webhook tool
export async function GET(req: NextRequest) {
  console.log("=== Memory Recall Endpoint Hit ===");

  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "Who is this person? What do I know about them?";

    console.log("Recall query:", query);

    // Search Kagan's knowledge graph for relevant facts
    const searchResults = await searchGraph(KAGAN_USER_ID, query);

    let memories: string[] = [];
    if (searchResults && searchResults.edges && searchResults.edges.length > 0) {
      memories = searchResults.edges
        .map((edge: { fact?: string }) => edge.fact)
        .filter(Boolean)
        .slice(0, 10); // Top 10 most relevant facts
    }

    console.log("Found", memories.length, "memories");

    return Response.json({
      memories,
      count: memories.length,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Memory recall error:", error);
    return Response.json({
      memories: [],
      count: 0,
      error: "Failed to recall memories"
    }, { status: 500, headers: corsHeaders });
  }
}

// Also support POST for flexibility
export async function POST(req: NextRequest) {
  console.log("=== Memory Recall Endpoint Hit (POST) ===");

  try {
    const body = await req.json();
    const query = body.query || "Who is this person? What do I know about them?";

    console.log("Recall query:", query);

    // Search Kagan's knowledge graph for relevant facts
    const searchResults = await searchGraph(KAGAN_USER_ID, query);

    let memories: string[] = [];
    if (searchResults && searchResults.edges && searchResults.edges.length > 0) {
      memories = searchResults.edges
        .map((edge: { fact?: string }) => edge.fact)
        .filter(Boolean)
        .slice(0, 10);
    }

    console.log("Found", memories.length, "memories");

    return Response.json({
      memories,
      count: memories.length,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Memory recall error:", error);
    return Response.json({
      memories: [],
      count: 0,
      error: "Failed to recall memories"
    }, { status: 500, headers: corsHeaders });
  }
}
