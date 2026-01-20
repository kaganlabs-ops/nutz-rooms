import { NextRequest } from "next/server";
import { openai, KAGAN_SYSTEM_PROMPT } from "@/lib/openai";
import { searchGraph, KAGAN_USER_ID, getModeState, saveModeState, clearModeState, isModeStateStale } from "@/lib/zep";
import { detectMode, detectExplicitModeSwitch } from "@/lib/router";
import { getMode, buildModePrompt } from "@/lib/modes";
import type { ModeState, ToolkitMode } from "@/lib/modes/types";

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

// Helper to initialize mode state
function initModeState(mode: ToolkitMode): ModeState {
  const modeConfig = getMode(mode);
  return {
    mode,
    currentStage: modeConfig.stages[0]?.id || '',
    stageData: {},
    startedAt: new Date().toISOString()
  };
}

// Helper to check if stage should advance
function shouldAdvanceStage(response: string, userMessage: string, state: ModeState): boolean {
  const mode = getMode(state.mode);
  const stage = mode.stages.find(s => s.id === state.currentStage);
  if (!stage || !stage.completionSignals.length) return false;

  const combined = (response + ' ' + userMessage).toLowerCase();
  return stage.completionSignals.some(signal => combined.includes(signal.toLowerCase()));
}

// Helper to advance stage
async function advanceStage(userId: string, state: ModeState): Promise<boolean> {
  const mode = getMode(state.mode);
  const currentStageIndex = mode.stages.findIndex(s => s.id === state.currentStage);
  const nextStage = mode.stages[currentStageIndex + 1];

  if (nextStage) {
    state.currentStage = nextStage.id;
    await saveModeState(userId, state);
    return true;
  }
  return false; // Mode complete
}

export async function POST(req: NextRequest) {
  console.log("=== Voice LLM Request Started ===");

  try {
    const bodyText = await req.text();
    const body: ChatCompletionRequest = JSON.parse(bodyText);
    const { messages, stream = true } = body;

    // Use KAGAN_USER_ID for voice calls (shared state with text chat)
    const userId = KAGAN_USER_ID;

    // Filter to just user/assistant messages for Claude
    let chatMessages = messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // If no user messages, create a placeholder to prevent empty array error
    if (chatMessages.length === 0) {
      chatMessages = [{ role: "user" as const, content: "Hello" }];
    }

    // Get the last user message
    const lastUserMessage = chatMessages.filter(m => m.role === "user").pop();
    const userMessage = lastUserMessage?.content || "";

    // Search for relevant memories
    let memories: string[] = [];
    try {
      const searchResults = await searchGraph(userId, userMessage);
      if (searchResults?.edges) {
        memories = searchResults.edges
          .map((edge: { fact?: string }) => edge.fact)
          .filter((f): f is string => Boolean(f))
          .slice(0, 5);
      }
    } catch (e) {
      console.error("Zep search error:", e);
    }

    // ============================================
    // ORCHESTRATOR LOGIC (same as text chat)
    // ============================================

    // Get current mode state
    let modeState = await getModeState(userId);

    // Check for stale mode state (older than 7 days)
    if (modeState && isModeStateStale(modeState)) {
      await clearModeState(userId, modeState.mode);
      modeState = null;
    }

    // Check for explicit mode switch or exit
    const explicitMode = detectExplicitModeSwitch(userMessage);
    if (explicitMode) {
      if (explicitMode === 'thought-partner') {
        // User wants to exit current mode
        if (modeState) {
          await clearModeState(userId, modeState.mode);
          modeState = null;
        }
      } else if (explicitMode !== modeState?.mode) {
        modeState = initModeState(explicitMode);
        await saveModeState(userId, modeState);
      }
    }

    // If no active mode, detect from message
    if (!modeState && !explicitMode) {
      const detectedMode = detectMode(userMessage, memories);
      if (detectedMode !== 'thought-partner') {
        modeState = initModeState(detectedMode);
        await saveModeState(userId, modeState);
        console.log("Mode detected:", detectedMode);
      }
    }

    // Build context-aware system prompt
    let systemPrompt: string;
    if (modeState) {
      systemPrompt = buildModePrompt(modeState);
      const mode = getMode(modeState.mode);
      const stage = mode.stages.find(s => s.id === modeState.currentStage);
      if (stage) {
        systemPrompt = `[ACTIVE MODE: ${mode.name} - Stage: ${stage.name}]\n\n` + systemPrompt;
      }
      console.log("Using mode prompt:", modeState.mode, "stage:", modeState.currentStage);
    } else {
      systemPrompt = KAGAN_SYSTEM_PROMPT;
    }

    // Add memory context
    if (memories.length > 0) {
      systemPrompt += `\n\n## Context from memory:\n${memories.join('\n')}`;
    }

    console.log("Stream mode:", stream, "Mode:", modeState?.mode || "thought-partner");
    console.log("System prompt length:", systemPrompt.length);
    console.log("System prompt preview:", systemPrompt.slice(0, 200));
    console.log("Chat messages:", JSON.stringify(chatMessages.slice(-2)));

    if (stream) {
      // Streaming response for ElevenLabs using GPT-4o-mini
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 80,
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
                // Stop at first newline for shorter responses
                if (content.includes('\n')) {
                  const beforeNewline = content.split('\n')[0];
                  fullResponse += beforeNewline;
                  if (beforeNewline) {
                    const outChunk = {
                      id,
                      object: "chat.completion.chunk",
                      created: Math.floor(Date.now() / 1000),
                      model: "gpt-4o-mini",
                      choices: [{
                        index: 0,
                        delta: { content: beforeNewline },
                        finish_reason: null,
                      }],
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(outChunk)}\n\n`));
                  }
                  break; // Stop streaming at newline
                }
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

            // Check stage completion and advance
            if (modeState && modeState.currentStage) {
              const shouldAdvance = shouldAdvanceStage(fullResponse, userMessage, modeState);
              if (shouldAdvance) {
                const advanced = await advanceStage(userId, modeState);
                if (!advanced) {
                  await clearModeState(userId, modeState.mode);
                }
                console.log("Stage advanced:", advanced);
              }
            }

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
        max_tokens: 80,
        messages: [
          { role: "system", content: systemPrompt },
          ...chatMessages,
        ],
      });

      let content = response.choices[0]?.message?.content || "";
      // Post-process: take first line only
      content = content.split('\n')[0].trim();

      // Check stage completion and advance
      if (modeState && modeState.currentStage) {
        const shouldAdvance = shouldAdvanceStage(content, userMessage, modeState);
        if (shouldAdvance) {
          const advanced = await advanceStage(userId, modeState);
          if (!advanced) {
            await clearModeState(userId, modeState.mode);
          }
        }
      }

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
