import { NextRequest } from "next/server";
import { anthropic, KAGAN_VOICE_PROMPT } from "@/lib/openai";
import { getUserMemoryFromThread, hasRealMemory } from "@/lib/zep";
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

// Extract userId from ElevenLabs system message (injected via dynamicVariables)
function extractUserId(messages: ChatMessage[]): string | null {
  const systemMsg = messages.find(m => m.role === "system");
  if (!systemMsg) return null;

  // ElevenLabs injects dynamic variables into the system prompt
  // Look for user_id pattern
  const match = systemMsg.content.match(/user_id[:\s]+([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`\n========================================`);
  console.log(`[VOICE] ${timestamp} - Request Started`);
  console.log(`========================================`);

  try {
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);
    const { messages, stream = true } = body as ChatCompletionRequest;

    // Log the full request body to see what ElevenLabs sends
    console.log(`[VOICE] Full request body keys:`, Object.keys(body));

    // Check for elevenlabs_extra_body (where dynamic variables might be passed)
    const extraBody = body.elevenlabs_extra_body || body.extra_body || {};
    console.log(`[VOICE] Extra body:`, JSON.stringify(extraBody));

    // Try to extract userId from various sources:
    // 1. elevenlabs_extra_body (if custom LLM extra body is enabled)
    // 2. System message (if agent has prompt with {{user_id}})
    let userId = extraBody.user_id || extraBody.userId || null;

    if (!userId) {
      // Fall back to extracting from system message
      userId = extractUserId(messages);
    }

    console.log(`[VOICE] Extracted userId: ${userId || "none"}`);

    if (!userId) {
      console.log(`[VOICE] WARNING: No userId found in system message, memory will not work`);
    }

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
    } else if (userId) {
      // Parallel fetch: brain cache (instant) + user memory (async)
      const [_brainPreload, userMemoryContext] = await Promise.all([
        Promise.resolve(getKaganBrain()),
        getUserMemoryFromThread(userId),
      ]);

      // Get relevant brain facts based on user's message
      const relevantBrainFacts = findRelevantFacts(userMessage, 5);

      // Add Kagan's brain context (shared knowledge)
      if (relevantBrainFacts.length > 0) {
        systemPrompt += `\n\n${formatBrainContext(relevantBrainFacts)}`;
      }

      // Add user's personal memory (pre-formatted from Zep)
      if (hasRealMemory(userMemoryContext)) {
        systemPrompt += `\n\n## USER MEMORY:\n${userMemoryContext}`;
        console.log(`[VOICE] Context: ${relevantBrainFacts.length} brain facts, user memory: ${userMemoryContext?.length || 0} chars`);
      } else {
        console.log(`[VOICE] Context: ${relevantBrainFacts.length} brain facts, no user memory`);
      }
    } else {
      // No userId - just use brain facts without user memory
      const relevantBrainFacts = findRelevantFacts(userMessage, 5);
      if (relevantBrainFacts.length > 0) {
        systemPrompt += `\n\n${formatBrainContext(relevantBrainFacts)}`;
      }
      console.log(`[VOICE] No userId - using ${relevantBrainFacts.length} brain facts only`);
    }

    console.log(`[VOICE] Stream mode: ${stream}, prompt length: ${systemPrompt.length}`);

    if (stream) {
      // Streaming response for ElevenLabs using Claude (same as chat)
      const response = await anthropic.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 150,
        system: systemPrompt,
        messages: chatMessages,
      });

      // Create a streaming response in OpenAI format (ElevenLabs expects this)
      const encoder = new TextEncoder();
      let fullResponse = "";

      const readable = new ReadableStream({
        async start(controller) {
          const id = `chatcmpl-${Date.now()}`;

          try {
            for await (const event of response) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                const content = event.delta.text || "";
                if (content) {
                  fullResponse += content;
                  // Convert to OpenAI format for ElevenLabs
                  const outChunk = {
                    id,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: "claude-sonnet-4",
                    choices: [{
                      index: 0,
                      delta: { content },
                      finish_reason: null,
                    }],
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(outChunk)}\n\n`));
                }
              }
            }

            console.log(`[VOICE] Kagan said: "${fullResponse}"`);
            console.log(`[VOICE] --- End of turn ---\n`);

            // Send final chunk
            const finalChunk = {
              id,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: "claude-sonnet-4",
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
      // Non-streaming response using Claude
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 150,
        system: systemPrompt,
        messages: chatMessages,
      });

      // Extract text from Claude's response format
      const content = response.content[0]?.type === 'text' ? response.content[0].text : "";

      // Return in OpenAI format for ElevenLabs compatibility
      return Response.json({
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "claude-sonnet-4",
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
