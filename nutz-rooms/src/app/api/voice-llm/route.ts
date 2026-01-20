import { NextRequest } from "next/server";
import { openai, KAGAN_VOICE_PROMPT } from "@/lib/openai";
import { getUserMemory, formatUserMemoryContext, KAGAN_USER_ID } from "@/lib/zep";
import { findRelevantFacts, formatBrainContext, getKaganBrain } from "@/lib/brain";

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
  const timestamp = new Date().toISOString();
  console.log(`\n========================================`);
  console.log(`[VOICE] ${timestamp} - Request Started`);
  console.log(`========================================`);

  try {
    const bodyText = await req.text();
    const body: ChatCompletionRequest = JSON.parse(bodyText);
    const { messages, stream = true } = body;

    // Use KAGAN_USER_ID for voice calls (shared state with text chat)
    const userId = KAGAN_USER_ID;

    // Log incoming messages (transcript)
    console.log(`[VOICE] Conversation history:`);
    messages.forEach((m, i) => {
      console.log(`  [${i}] ${m.role}: "${m.content}"`);
    });

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
    console.log(`[VOICE] User said: "${userMessage}"`);

    // Simple messages that don't need memory lookup (faster voice responses)
    const simpleMessages = ['hey', 'hi', 'hello', 'yo', 'sup', 'whats up', "what's up", 'how are you', 'good morning', 'good evening'];
    const isSimpleMessage = simpleMessages.some(s => userMessage.toLowerCase().trim() === s || userMessage.toLowerCase().trim().startsWith(s + ' '));

    // Build system prompt
    let systemPrompt = KAGAN_VOICE_PROMPT;

    // For simple greetings, just use cached brain (instant)
    // For real questions, fetch user memory in parallel with brain
    if (isSimpleMessage) {
      // Just preload cache (instant)
      getKaganBrain();
      console.log(`[VOICE] Simple greeting - skipping memory lookup`);
    } else {
      // Parallel fetch: brain cache (instant) + user memory (async)
      const [_brainPreload, userMemories] = await Promise.all([
        Promise.resolve(getKaganBrain()),
        getUserMemory(userId, userMessage, 10),
      ]);

      // Get relevant brain facts based on user's message
      const relevantBrainFacts = findRelevantFacts(userMessage, 5);

      // Add Kagan's brain context (shared knowledge)
      if (relevantBrainFacts.length > 0) {
        systemPrompt += `\n\n${formatBrainContext(relevantBrainFacts)}`;
      }

      // Add user's personal memory
      if (userMemories.length > 0) {
        systemPrompt += `\n\n${formatUserMemoryContext(userMemories)}`;
      }

      console.log(`[VOICE] Context: ${relevantBrainFacts.length} brain facts, ${userMemories.length} user memories`);
    }

    console.log(`[VOICE] Stream mode: ${stream}, prompt length: ${systemPrompt.length}`);

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

            console.log(`[VOICE] Kagan said: "${fullResponse}"`);
            console.log(`[VOICE] --- End of turn ---\n`);

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
