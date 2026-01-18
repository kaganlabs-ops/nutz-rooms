import { NextRequest } from "next/server";
import { addToGraph, KAGAN_USER_ID } from "@/lib/zep";

// CORS headers for ElevenLabs webhook
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Save new memories to Zep knowledge graph
// ElevenLabs will call this as a webhook tool
export async function POST(req: NextRequest) {
  console.log("=== Memory Save Endpoint Hit ===");

  try {
    const body = await req.json();
    const { content } = body;

    if (!content) {
      return Response.json({
        success: false,
        error: "No content provided"
      }, { status: 400, headers: corsHeaders });
    }

    console.log("Saving memory:", content.slice(0, 100));

    // Add to Kagan's knowledge graph
    const success = await addToGraph(KAGAN_USER_ID, content);

    if (success) {
      console.log("Memory saved successfully");
      return Response.json({
        success: true,
        message: "Memory saved successfully"
      }, { headers: corsHeaders });
    } else {
      console.log("Failed to save memory");
      return Response.json({
        success: false,
        error: "Failed to save memory"
      }, { status: 500, headers: corsHeaders });
    }
  } catch (error) {
    console.error("Memory save error:", error);
    return Response.json({
      success: false,
      error: "Failed to save memory"
    }, { status: 500, headers: corsHeaders });
  }
}
