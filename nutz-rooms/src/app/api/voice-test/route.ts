import { NextRequest } from "next/server";

// Simple test endpoint for ElevenLabs
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  console.log("=== VOICE TEST ENDPOINT HIT ===");
  console.log("Time:", new Date().toISOString());

  // Return immediate static response
  return Response.json({
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "test-model",
    choices: [{
      index: 0,
      message: { role: "assistant", content: "Hey! This is a test response." },
      finish_reason: "stop",
    }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 10,
      total_tokens: 20,
    },
  }, { headers: corsHeaders });
}
