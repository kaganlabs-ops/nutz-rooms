import { NextRequest } from "next/server";
import { anthropic, KAGAN_SYSTEM_PROMPT } from "@/lib/openai";
import { searchGraph, KAGAN_USER_ID } from "@/lib/zep";

// CORS headers for ElevenLabs
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// ElevenLabs sends OpenAI-compatible requests, we need to respond in the same format
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionRequest {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export async function POST(req: NextRequest) {
  console.log("=== Voice LLM Request Started ===");
  console.log("Request URL:", req.url);
  console.log("Request headers:", JSON.stringify(Object.fromEntries(req.headers.entries())));

  try {
    const bodyText = await req.text();
    console.log("Raw request body:", bodyText.slice(0, 500));

    const body: ChatCompletionRequest = JSON.parse(bodyText);
    const { messages, stream = true } = body;

    console.log("Parsed request - stream:", stream, "messages:", messages.length);

    // Filter to just user/assistant messages for Claude
    let chatMessages = messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // If no user messages, create a placeholder to prevent empty array error
    if (chatMessages.length === 0) {
      console.log("No user messages found, using placeholder");
      chatMessages = [{ role: "user" as const, content: "Hello" }];
    }

    console.log("Filtered chat messages:", chatMessages.length);

    // Try to get context from Zep knowledge graph by searching
    let context = "";
    try {
      // Get the last user message to search for relevant context
      const lastUserMessage = chatMessages.filter(m => m.role === "user").pop();
      console.log("Last user message:", lastUserMessage?.content?.slice(0, 100));

      if (lastUserMessage) {
        // Search Kagan's knowledge graph for relevant facts
        console.log("Searching Zep for:", lastUserMessage.content);
        const searchResults = await searchGraph(KAGAN_USER_ID, lastUserMessage.content);
        console.log("Zep search results:", searchResults ? "found" : "null", searchResults?.edges?.length || 0, "edges");

        if (searchResults && searchResults.edges && searchResults.edges.length > 0) {
          // Extract facts from search results
          const facts = searchResults.edges
            .map((edge: { fact?: string }) => edge.fact)
            .filter(Boolean)
            .slice(0, 10); // Limit to top 10 most relevant facts
          if (facts.length > 0) {
            context = facts.join("\n");
            console.log("Context found:", facts.length, "facts");
          }
        }
      }
    } catch (e) {
      console.error("Zep search error:", e);
      // Continue without context if Zep fails
    }

    // Build system prompt with Zep context
    const systemPrompt = context
      ? `${KAGAN_SYSTEM_PROMPT}\n\nRelevant context from memory:\n${context}`
      : KAGAN_SYSTEM_PROMPT;

    console.log("Stream mode:", stream);
    console.log("Chat messages to send:", chatMessages.length);

    if (stream) {
      console.log("Starting streaming response...");
      // Streaming response for ElevenLabs
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: chatMessages,
        stream: true,
      });

      console.log("Claude stream created, sending chunks...");

      // Create a streaming response in OpenAI format
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const id = `chatcmpl-${Date.now()}`;
          let chunkCount = 0;

          try {
            for await (const event of response) {
              if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                chunkCount++;
                const chunk = {
                  id,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model: "claude-sonnet-4-20250514",
                  choices: [{
                    index: 0,
                    delta: { content: event.delta.text },
                    finish_reason: null,
                  }],
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
              }
            }

            console.log("Streaming complete, sent", chunkCount, "chunks");

            // Send final chunk
            const finalChunk = {
              id,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: "claude-sonnet-4-20250514",
              choices: [{
                index: 0,
                delta: {},
                finish_reason: "stop",
              }],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (streamError) {
            console.error("Stream error:", streamError);
            controller.error(streamError);
          }
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
    } else {
      // Non-streaming response
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: chatMessages,
      });

      const textBlock = response.content.find(block => block.type === "text");
      const content = textBlock?.type === "text" ? textBlock.text : "";

      return Response.json({
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "claude-sonnet-4-20250514",
        choices: [{
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      }, { headers: corsHeaders });
    }
  } catch (error) {
    console.error("Voice LLM error:", error);
    return Response.json(
      { error: "Failed to process voice request" },
      { status: 500, headers: corsHeaders }
    );
  }
}
