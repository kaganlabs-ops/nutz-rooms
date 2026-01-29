import { NextRequest, NextResponse } from "next/server";
import { ensureUser, createThread, addMessages, getThreadMessages, getUserContext } from "@/lib/zep";
import { parseArtifact } from "@/lib/artifacts";
import { searchGif } from "@/lib/giphy";
import { extractOneThing } from "@/lib/sessionStorage";
import { setTaskEntry, updateTaskComplete, updateTaskError } from "@/lib/redis";
import { createAgent } from "@/lib/agent";
import { BrainFact } from "@/types";

export async function POST(req: NextRequest) {
  console.log(`\n\n========== [CHAT-V2] NEW REQUEST ==========`);
  const startTime = Date.now();

  try {
    const {
      message,
      threadId: existingThreadId,
      userId,
      sessionMetadata,
      creatorId = 'kagan'
    } = await req.json();

    if (!message || !userId) {
      return NextResponse.json(
        { error: "Message and userId are required" },
        { status: 400 }
      );
    }

    console.log(`[CHAT-V2] Request from user: ${userId}, creator: ${creatorId}`);

    // ============================================
    // STEP 1: ZEP SETUP (same as v1)
    // ============================================

    await ensureUser(userId);
    let threadId = existingThreadId;
    const isNewSession = !threadId;
    if (!threadId) {
      threadId = await createThread(userId);
    }

    await addMessages(threadId, [
      { role: "user", content: message, name: "User" },
    ]);

    // ============================================
    // STEP 2: MEMORY CONTEXT (same as v1)
    // ============================================

    const [memoryContext, threadMessages] = await Promise.all([
      getUserContext(threadId),
      getThreadMessages(threadId),
    ]);

    console.log(`[CHAT-V2] Memory fetch completed in ${Date.now() - startTime}ms`);

    const messageHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
    // Use full conversation history (Zep manages this, Claude context window is large enough)
    for (const msg of threadMessages) {
      if ((msg.role === "user" || msg.role === "assistant") && msg.content && msg.content.trim()) {
        messageHistory.push({ role: msg.role, content: msg.content });
      }
    }

    // ============================================
    // STEP 3: CONTEXT (lean architecture - no brain.ts)
    // ============================================

    // Brain facts removed - knowledge now comes from prompt + tools
    const brainFacts: BrainFact[] = [];

    console.log(`[CHAT-V2] Context ready, memory: ${!!memoryContext}`);

    // ============================================
    // AGENT CALL - Claude decides everything
    // If tools detected → return immediately, execute in background
    // If no tools → return response directly
    // ============================================

    console.log(`[CHAT-V2] ========== AGENT CALL ==========`);
    console.log(`[CHAT-V2] 🤖 Calling agent with message: "${message}"`);

    const agent = createAgent(creatorId, userId);
    const agentResponse = await agent.chat(message, {
      history: messageHistory,
      zepContext: memoryContext,
      brainFacts,
      sessionMetadata: sessionMetadata || null,
      returnEarlyOnTools: true, // Return early when tools are detected
    });

    // Check if tools were detected (agent returned early)
    if (agentResponse.pendingTools && agentResponse.pendingTools.length > 0 && agentResponse.continueExecution) {
      const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const pendingTools = agentResponse.pendingTools;

      // Determine task type from tools
      const taskType = pendingTools.some(t => t.includes('image') || t.includes('background')) ? 'image' :
                       pendingTools.some(t => t.includes('video')) ? 'video' :
                       pendingTools.some(t => t.includes('music') || t.includes('audio')) ? 'audio' :
                       pendingTools.some(t => t.includes('email') || t.includes('mail')) ? 'email' : 'other';

      console.log(`[CHAT-V2] 🔧 Tools detected: ${pendingTools.join(', ')}, switching to async. taskId: ${taskId}`);

      // Create task entry
      await setTaskEntry(taskId, {
        status: 'running',
        type: taskType,
        startTime: Date.now(),
        description: `using ${pendingTools[0]}...`,
      });

      // Execute tools in background (fire and forget)
      agentResponse.continueExecution().then(async (finalResponse) => {
        console.log(`[CHAT-V2] ✅ Tools completed for task ${taskId}`);

        // Extract media URLs from tool results
        let imageUrl: string | undefined;
        let videoUrl: string | undefined;
        let audioUrl: string | undefined;

        if (finalResponse.toolResults?.length) {
          for (const tr of finalResponse.toolResults) {
            const result = tr.result as { success?: boolean; data?: Record<string, unknown> };
            if (result?.success && result?.data) {
              if (result.data.imageUrl) imageUrl = result.data.imageUrl as string;
              if (result.data.videoUrl) videoUrl = result.data.videoUrl as string;
              if (result.data.audioUrl) audioUrl = result.data.audioUrl as string;
            }
          }
        }

        // Update task with result
        await updateTaskComplete(taskId, {
          text: finalResponse.text,
          imageUrl,
          videoUrl,
          audioUrl,
          data: { toolResults: finalResponse.toolResults },
        });

        // Save full response to Zep
        if (finalResponse.text?.trim()) {
          try {
            await addMessages(threadId, [
              { role: "assistant", content: finalResponse.text, name: "Kagan" },
            ]);
          } catch (err) {
            console.error('[CHAT-V2] Failed to save async response to Zep:', err);
          }
        }
      }).catch(async (err) => {
        console.error(`[CHAT-V2] ❌ Tool execution failed for task ${taskId}:`, err);
        await updateTaskError(taskId, err instanceof Error ? err.message : 'Tool execution failed');
      });

      // Return immediately so user can keep chatting (banner handles progress, no chat message needed)
      return NextResponse.json({
        response: '',
        threadId,
        artifact: null,
        gifUrl: null,
        imageUrl: null,
        oneThing: null,
        isNewSession,
        buildId: null,
        isBuilding: false,
        taskId,
        taskType,
      });
    }

    // No tools - direct response
    console.log(`[CHAT-V2] ⚡ No tools, direct response in ${Date.now() - startTime}ms`);

    // Extract image URL from tool results (FAL generate_image)
    let imageUrl: string | null = null;
    if (agentResponse.toolResults?.length) {
      for (const tr of agentResponse.toolResults) {
        const result = tr.result as { success?: boolean; data?: { imageUrl?: string } };
        if (result?.success && result?.data?.imageUrl) {
          imageUrl = result.data.imageUrl;
          console.log(`[CHAT-V2] 🖼️ Extracted image URL:`, imageUrl);
          break;
        }
      }
    }

    const rawResponse = agentResponse.text;

    // ============================================
    // STEP 5: ARTIFACT PARSING (same as v1)
    // ============================================

    const { text: textWithGifMarkers, artifact } = parseArtifact(rawResponse);

    // ============================================
    // STEP 6: GIF HANDLING (same as v1)
    // ============================================

    let responseText = textWithGifMarkers;
    const gifMatch = textWithGifMarkers.match(/\[GIF:\s*([^\]]+)\]/i);
    let gifUrl: string | null = null;
    if (gifMatch) {
      const searchTerm = gifMatch[1].trim();
      gifUrl = await searchGif(searchTerm);
      responseText = textWithGifMarkers.replace(gifMatch[0], '').trim() || "";
    }

    // ============================================
    // STEP 7: ONE THING (from agent or fallback)
    // ============================================

    const oneThing = agentResponse.oneThing || extractOneThing(rawResponse);

    // ============================================
    // SAVE TO ZEP
    // ============================================

    if (responseText?.trim()) {
      try {
        await addMessages(threadId, [{ role: "assistant", content: responseText, name: "Kagan" }]);
      } catch (err) {
        console.error('[CHAT-V2] Save failed:', err);
      }
    }

    console.log(`[CHAT-V2] Total: ${Date.now() - startTime}ms`);

    // ============================================
    // RETURN SAME FORMAT AS V1
    // ============================================

    return NextResponse.json({
      response: responseText,
      threadId,
      artifact,
      gifUrl,
      imageUrl,
      oneThing,
      isNewSession,
      buildId: null,
      isBuilding: false,
      referral: null,
    });

  } catch (error) {
    console.error("[CHAT-V2] ❌ ERROR:", error);
    if (error instanceof Error) {
      console.error("[CHAT-V2] Stack:", error.stack);
    }
    return NextResponse.json(
      { error: `Failed to process chat: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
