import { NextRequest } from "next/server";
import { openai, KAGAN_VOICE_PROMPT } from "@/lib/openai";
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

  try {
    const bodyText = await req.text();
    const body: ChatCompletionRequest = JSON.parse(bodyText);
    const { messages, stream = true } = body;

    // Use KAGAN_USER_ID for voice calls (shared state with text chat)
    const userId = KAGAN_USER_ID;

    // Filter to just user/assistant messages
    let chatMessages = messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // If no user messages, create a placeholder
    if (chatMessages.length === 0) {
      chatMessages = [{ role: "user" as const, content: "Hello" }];
    }

    // Get the last user message
    const lastUserMessage = chatMessages.filter(m => m.role === "user").pop();
    const userMessage = lastUserMessage?.content || "";

    // Simple messages that don't need memory lookup (faster voice responses)
    const simpleMessages = ['hey', 'hi', 'hello', 'yo', 'sup', 'whats up', "what's up", 'how are you', 'good morning', 'good evening'];
    const isSimpleMessage = simpleMessages.some(s => userMessage.toLowerCase().trim() === s || userMessage.toLowerCase().trim().startsWith(s + ' '));

    // Build system prompt
    let systemPrompt = KAGAN_VOICE_PROMPT;

    // Search for relevant memories (skip for simple greetings)
    if (!isSimpleMessage) {
      try {
        const searchResults = await searchGraph(userId, userMessage);
        if (searchResults?.edges) {
          const memories = searchResults.edges
            .map((edge: { fact?: string }) => edge.fact)
            .filter((f): f is string => Boolean(f))
            .slice(0, 5);

          if (memories.length > 0) {
            systemPrompt += `\n\n## Context from memory:\n${memories.join('\n')}`;
          }
        }
      } catch (e) {
        console.error("Zep search error:", e);
      }
    }

    console.log("Stream mode:", stream);
    console.log("System prompt length:", systemPrompt.length);

    if (stream) {
      // Streaming response for ElevenLabs using GPT-4o-mini
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 150,
        messages: [
          { role: "system", content: systemPrompt },
          ...chatMessages,
        ],
        stream: true,
      });

      // Create a streaming response in OpenAI format
      const encoder = new TextEncoder();
      let fullResponse = "";

      const readable = new ReadableStream({
        async start(controller) {
          const id = `chatcmpl-${Date.now()}`;

          try {
            for await (const chunk of response) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (content) {
                fullResponse += content;
                const outChunk = {
                  id,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model: "gpt-4o-mini",
                  choices: [{
                    index: 0,
                    delta: { content },
                    finish_reason: null,
                  }],
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(outChunk)}\n\n`));
              }
            }

            console.log("Full response:", fullResponse);

            // Send final chunk
            const finalChunk = {
              id,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: "gpt-4o-mini",
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
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 150,
        messages: [
          { role: "system", content: systemPrompt },
          ...chatMessages,
        ],
      });

      const content = response.choices[0]?.message?.content || "";

      return Response.json({
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "gpt-4o-mini",
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
