import { NextRequest } from "next/server";

// Simple test endpoint for ElevenLabs - with STREAMING SSE
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

  // Log request details
  try {
    const body = await req.json();
    console.log("Request body:", JSON.stringify(body).slice(0, 500));
  } catch (e) {
    console.log("Could not parse body:", e);
  }

  // Return STREAMING SSE response (required by ElevenLabs)
  const encoder = new TextEncoder();
  const id = `chatcmpl-${Date.now()}`;
  const testMessage = "Hey! This is a test response.";

  const readable = new ReadableStream({
    start(controller) {
      // Send content chunk
      const chunk = {
        id,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "test-model",
        choices: [{
          index: 0,
          delta: { content: testMessage },
          finish_reason: null,
        }],
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));

      // Send final chunk
      const finalChunk = {
        id,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "test-model",
        choices: [{
          index: 0,
          delta: {},
          finish_reason: "stop",
        }],
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();

      console.log("Streaming response sent successfully");
    },
  });

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
