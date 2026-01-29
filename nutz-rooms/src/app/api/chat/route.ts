import { NextRequest, NextResponse } from "next/server";
import { ensureUser, createThread, addMessages, getThreadMessages, getUserContext } from "@/lib/zep";
import { parseArtifact } from "@/lib/artifacts";
import { searchGif } from "@/lib/giphy";
import { extractOneThing } from "@/lib/sessionStorage";
import { setBuildEntry, updateBuildComplete, updateBuildError, setTaskEntry, updateTaskComplete, updateTaskError } from "@/lib/redis";
import { createAgent } from "@/lib/agent";
import { getConnectedApps, initiateConnection } from "@/lib/integrations/composio";
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
    // FAST PATH: Instant response for build requests
    // ============================================

    // Skip fast path for image/video/audio generation (let agent use FAL tools)
    // Also skip for image editing keywords (realistic, 3d, icon, logo, etc.)
    const isMediaGeneration = /\b(generate|create|make)\s+(an?\s+)?(image|picture|photo|video|audio|music|song|icon|logo|illustration|artwork)\b/i.test(message)
      || /\b(realistic|hyper.?realistic|3d|transparent|edit.*image|remove.*background)\b/i.test(message);

    // Skip fast path for fitness-related "build" phrases (build muscle, build strength, etc.)
    const isFitnessBuild = /\b(build|gain|grow)\s+(muscle|strength|mass|endurance|stamina)\b/i.test(message);

    console.log(`[CHAT-V2] isMediaGeneration=${isMediaGeneration}, isFitnessBuild=${isFitnessBuild} for message: "${message}"`);

    const buildMatch = message.toLowerCase().match(/(?:build|make|create)\s+(?:me\s+)?(?:a\s+)?(.+?)(?:\s+app|\s+game|\s+demo|\s+tool|\s+page)?$/i);
    console.log(`[CHAT-V2] buildMatch=${!!buildMatch}, skipping fast path=${isMediaGeneration || isFitnessBuild}`);
    if (buildMatch && !isMediaGeneration && !isFitnessBuild) {
      const thing = buildMatch[1].replace(/\s+(app|game|demo|tool|page|for\s+.*)$/i, '').trim();
      const fastBuildId = `build-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const fastResponse = `building u ${thing}`;

      console.log(`[CHAT-V2] FAST PATH: Build detected for "${thing}", ID: ${fastBuildId}`);

      // Save to Zep
      await addMessages(threadId, [
        { role: "assistant", content: fastResponse, name: "Kagan" },
      ]);

      // Start build in background
      await setBuildEntry(fastBuildId, { status: 'building', startTime: Date.now() });

      const recentContext = messageHistory.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n');
      fetch(new URL('/api/agent', req.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'Build a working prototype/demo based on the conversation. Deploy it and return the URL.',
          context: `${recentContext}\nuser: ${message}`,
          transcript: [...messageHistory, { role: 'user', content: message }],
          buildId: fastBuildId,
        }),
      }).then(async (res) => {
        if (!res.ok) throw new Error(`Agent returned ${res.status}`);
        const data = await res.json();
        await updateBuildComplete(fastBuildId, { deployedUrl: data.deployedUrl, document: data.document });
      }).catch(async (err) => {
        await updateBuildError(fastBuildId, err instanceof Error ? err.message : 'Unknown error');
      });

      // Return immediately
      return NextResponse.json({
        response: fastResponse,
        threadId,
        artifact: null,
        gifUrl: null,
        oneThing: null,
        isNewSession,
        buildId: fastBuildId,
        isBuilding: true,
      });
    }

    // ============================================
    // FAST PATH: Integration requests (email, calendar)
    // ============================================

    const integrationPatterns: { pattern: RegExp; app: string; action: string }[] = [
      { pattern: /\b(read|check|show|get)\s+(my\s+)?(email|mail|inbox)/i, app: 'gmail', action: 'read emails' },
      { pattern: /\b(send|write|compose)\s+(an?\s+)?(email|mail)/i, app: 'gmail', action: 'send emails' },
      { pattern: /\b(read|check|show|get)\s+(my\s+)?(calendar|events|schedule)/i, app: 'googlecalendar', action: 'check calendar' },
      { pattern: /\b(create|add|schedule)\s+(a\s+)?(meeting|event|appointment)/i, app: 'googlecalendar', action: 'create events' },
    ];

    for (const { pattern, app, action } of integrationPatterns) {
      if (pattern.test(message)) {
        console.log(`[CHAT-V2] Integration pattern matched: ${app} for "${action}", userId=${userId}`);
        const connectedApps = await getConnectedApps(userId);
        console.log(`[CHAT-V2] Connected apps for ${userId}:`, connectedApps);

        if (!connectedApps.includes(app)) {
          console.log(`[CHAT-V2] Integration needed: ${app} for "${action}" - not in connected apps`);

          try {
            const { redirectUrl: authUrl } = await initiateConnection(userId, app);
            const response = `to ${action}, u need to connect ${app === 'gmail' ? 'Gmail' : 'Google Calendar'} first\n\ntap here to connect: ${authUrl}`;

            await addMessages(threadId, [
              { role: "assistant", content: response, name: "Kagan" },
            ]);

            return NextResponse.json({
              response,
              threadId,
              artifact: null,
              gifUrl: null,
              oneThing: null,
              isNewSession,
              buildId: null,
              isBuilding: false,
              needsAuth: { app, authUrl },
            });
          } catch (err) {
            console.error(`[CHAT-V2] Failed to get auth URL for ${app}:`, err);
            // Fall through to normal agent call
          }
        } else {
          console.log(`[CHAT-V2] ✅ ${app} IS connected! Proceeding to agent with tool access.`);
        }
        break;
      }
    }

    // ============================================
    // Referral detection removed - agent handles referrals via refer_to_agent tool

    // ============================================
    // STEP 5: AGENT CALL WITH TOOL DETECTION
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
    // STEP 8: BUILD TRIGGERS (same as v1)
    // ============================================

    const { shouldBuild, type: createType } = agentResponse.buildIntent;
    const buildId = shouldBuild && createType
      ? `build-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      : null;

    if (shouldBuild && createType && buildId) {
      console.log(`[CHAT-V2] BUILD INTENT: ${createType}, ID: ${buildId}`);

      const recentContext = messageHistory.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n');

      await setBuildEntry(buildId, { status: 'building', startTime: Date.now() });

      fetch(new URL('/api/agent', req.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: createType === 'build'
            ? 'Build a working prototype/demo based on the conversation. Deploy it and return the URL.'
            : 'Create a document based on the conversation. Use Kagan\'s principles.',
          context: recentContext,
          transcript: messageHistory,
          buildId,
        }),
      }).then(async (res) => {
        if (!res.ok) throw new Error(`Agent returned ${res.status}`);
        const data = await res.json();
        await updateBuildComplete(buildId, { deployedUrl: data.deployedUrl, document: data.document });
      }).catch(async (err) => {
        await updateBuildError(buildId, err instanceof Error ? err.message : 'Unknown error');
      });
    }

    // ============================================
    // STEP 9: SAVE TO ZEP
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
      buildId,
      isBuilding: !!buildId,
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
