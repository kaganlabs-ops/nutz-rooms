import { NextRequest, NextResponse } from "next/server";
import { ensureUser, createThread, addMessages, getThreadMessages, getUserContext } from "@/lib/zep";
import { anthropic, KAGAN_SYSTEM_PROMPT } from "@/lib/openai";
import { parseArtifact } from "@/lib/artifacts";
import { searchGif } from "@/lib/giphy";
import { findRelevantFacts, formatBrainContext } from "@/lib/brain";
import { buildSessionContextFromAPI, extractOneThing } from "@/lib/sessionStorage";

// Store for tracking agent builds (module-level for persistence across requests)
interface AgentBuildEntry {
  promise: Promise<Response>;
  status: 'building' | 'complete' | 'error';
  startTime: number;
  result?: {
    deployedUrl?: string;
    document?: { title: string; content: string; type: string };
  };
  error?: string;
}
export const agentBuilds = new Map<string, AgentBuildEntry>();

// Detect if USER is asking for something to be built
// This triggers BEFORE Claude responds so we can inject context
const detectUserBuildIntent = (userMessage: string): { wantsBuild: boolean; wantsDoc: boolean } => {
  const lower = userMessage.toLowerCase();

  // User asking for something to SHOW (build)
  const buildSignals = [
    "build me",
    "make me",
    "create me",
    "demo",
    "prototype",
    "landing page",
    "app",
    "game",
    "something to show",
    "something i can show",
    "send me something",
    "put together a demo",
    "spin up",
  ];

  // User asking for something to THINK (document)
  const docSignals = [
    "clarity",
    "help me think",
    "organize",
    "priorities",
    "plan",
    "what should i focus",
  ];

  const wantsBuild = buildSignals.some(s => lower.includes(s));
  const wantsDoc = docSignals.some(s => lower.includes(s));

  return { wantsBuild, wantsDoc };
};

// Detect if Kagan's response indicates he's committing to create something
const detectKaganCreateIntent = (text: string): { shouldCreate: boolean; type: 'build' | 'document' | null } => {
  const lower = text.toLowerCase();

  // Build triggers - Kagan saying he'll build
  const buildTriggers = [
    "building that now",
    "let me build that",
    "on it, building",
    "building you",
    "let me build you",
    "gonna build",
    "let me build",
    "let me make you",
    "making you a",
    "let me spin up",
    "spinning up",
    "let me create",
    "creating a prototype",
    "building a prototype",
    "let me put together a demo",
  ];

  // Document triggers - markdown docs
  const docTriggers = [
    "let me put together some clarity",
    "let me organize",
    "putting together a plan",
    "let me outline",
    "writing up",
    "let me draft",
  ];

  if (buildTriggers.some(t => lower.includes(t))) {
    return { shouldCreate: true, type: 'build' };
  }

  if (docTriggers.some(t => lower.includes(t))) {
    return { shouldCreate: true, type: 'document' };
  }

  return { shouldCreate: false, type: null };
};

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const {
      message,
      threadId: existingThreadId,
      userId,
      // Session metadata from client (localStorage)
      sessionMetadata
    } = await req.json();

    if (!message || !userId) {
      return NextResponse.json(
        { error: "Message and userId are required" },
        { status: 400 }
      );
    }

    console.log(`[CHAT] Request from user: ${userId}`);
    if (sessionMetadata) {
      console.log(`[CHAT] Session metadata: count=${sessionMetadata.sessionCount}, lastOneThing=${sessionMetadata.lastOneThing || 'none'}`);
    }

    // ============================================
    // STEP 1: Setup user and thread
    // ============================================

    await ensureUser(userId);
    let threadId = existingThreadId;
    const isNewSession = !threadId;
    if (!threadId) {
      threadId = await createThread(userId);
    }

    // Add user message to thread FIRST (so Zep can use it for context retrieval)
    await addMessages(threadId, [
      { role: "user", content: message, name: "User" },
    ]);

    // ============================================
    // STEP 2: GET MEMORY CONTEXT
    // thread.getUserContext() is the KEY method:
    // - Uses last 2 messages to search the ENTIRE user graph
    // - Returns pre-formatted context block with user summary + relevant facts
    // - Works across ALL sessions, not just current thread
    // ============================================

    const [memoryContext, threadMessages] = await Promise.all([
      getUserContext(threadId),
      getThreadMessages(threadId),
    ]);

    const parallelTime = Date.now() - startTime;
    console.log(`[CHAT] Memory fetch completed in ${parallelTime}ms`);
    console.log(`[CHAT] Memory context from Zep:`, memoryContext?.slice(0, 300) || 'none');

    // Get conversation history (last 6 messages as fallback - Zep ingestion takes a few mins)
    const messageHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
    const recentMessages = threadMessages.slice(-6);
    for (const msg of recentMessages) {
      if ((msg.role === "user" || msg.role === "assistant") && msg.content && msg.content.trim()) {
        messageHistory.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // ============================================
    // BUILD CONTEXT: Session + Brain + Zep memory
    // ============================================

    // Get relevant facts from Kagan's brain based on message
    const relevantBrainFacts = findRelevantFacts(message, 8);

    // Build system prompt with combined context
    let systemPrompt = KAGAN_SYSTEM_PROMPT;

    // Add Kagan's brain (shared knowledge about Kagan)
    if (relevantBrainFacts.length > 0) {
      systemPrompt += `\n\n${formatBrainContext(relevantBrainFacts)}`;
    }

    // Check if there's REAL content in Zep memory (not just empty template)
    const hasUserSummary = memoryContext?.includes('<USER_SUMMARY>') &&
                           !memoryContext.includes('No other personal or lifestyle details are currently known');
    const hasRealFacts = memoryContext?.includes('<FACTS>') &&
                         !memoryContext.match(/<FACTS>\s*<\/FACTS>/) &&
                         !memoryContext.match(/<FACTS>\s*\n\s*<\/FACTS>/);
    const hasMemory = hasUserSummary || hasRealFacts;

    console.log(`[CHAT] Memory analysis: hasUserSummary=${hasUserSummary}, hasRealFacts=${hasRealFacts}, hasMemory=${hasMemory}`);

    // Build session context (time since last session, ONE THING, relationship depth)
    const sessionContext = buildSessionContextFromAPI(sessionMetadata, hasMemory ? memoryContext : null);

    if (sessionContext) {
      systemPrompt += `\n\n## SESSION CONTEXT\n${sessionContext}`;
    }

    // Add returning user instructions based on context
    if (hasMemory || sessionMetadata?.lastOneThing || sessionMetadata?.sessionCount > 1) {
      systemPrompt += `\n\n## RETURNING USER RULES

You have context about this user above. USE IT.

IF user has memory context:
- DONT say generic opener ("well well well", "what are u working on")
- Reference their project by name
- Ask about progress, not basics

IF they had a ONE THING last session:
- Follow up on it early: "did u [action item]?"
- Dont wait for them to bring it up
- If they did it, acknowledge and move on
- If they didn't, thats fine, ask whats blocking them

IF session gap is very short (minutes):
- "back already? 👀 whats up"

IF session gap is same day:
- "hey again. any updates?"

IF session gap is days:
- "been a few days. hows [project] going"

IF session gap is week+:
- "been a minute. whats new with [project]"

IF session count > 10:
- You know this person well. Be more familiar, reference past convos naturally.

NEVER ask "what are you working on" if you already know from memory.
NEVER make up memories. If context is empty, you're meeting them fresh.`;
    }

    // Add memory section
    if (hasMemory) {
      systemPrompt += `\n\n## ZEP MEMORY - What I know about this user:
${memoryContext}

## CRITICAL MEMORY RULES:
1. USER_SUMMARY = long-term facts about who they are (job, projects, preferences)
2. FACTS = specific things from recent conversations with dates

IMPORTANT:
- Only reference things EXPLICITLY in the memory above
- If they ask "what did we talk about last time" - look at FACTS section for dated items
- If FACTS section is empty or only has meta-info like "Assistant asked..." - say "im not seeing specifics from our last convo"
- NEVER make up or hallucinate conversations that aren't in FACTS
- You can reference USER_SUMMARY for who they are, but NOT for what they said recently
- If they just say "hey", greet based on USER_SUMMARY (their projects/work)`;
    } else if (!sessionMetadata?.sessionCount || sessionMetadata.sessionCount <= 1) {
      systemPrompt += `\n\n## MEMORY:
NO MEMORY AVAILABLE. This is a new user or I have no context from past conversations.

CRITICAL:
- Do NOT make up or hallucinate past conversations
- If user asks "what did I tell you last time" - say "i dont have context from our last convo, whats up?"
- Be direct: "im not seeing our past convos, fill me in"`;
    }

    console.log(`[CHAT] Context: ${relevantBrainFacts.length} brain facts, memory: ${hasMemory}, session: ${sessionMetadata ? 'yes' : 'no'}`);

    // ============================================
    // STEP 3: CALL CLAUDE
    // ============================================

    const claudeStartTime = Date.now();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [...messageHistory, { role: "user", content: message }],
    });

    const claudeTime = Date.now() - claudeStartTime;
    console.log(`[CHAT] Claude responded in ${claudeTime}ms`);

    const textBlock = response.content.find((block) => block.type === "text");
    const rawResponse = textBlock?.type === "text" ? textBlock.text : "";

    // Parse artifacts from response
    const { text: textWithGifMarkers, artifact } = parseArtifact(rawResponse);

    // Process GIF markers [GIF: search term] -> actual gif URLs
    let responseText = textWithGifMarkers;
    const gifMatch = textWithGifMarkers.match(/\[GIF:\s*([^\]]+)\]/i);
    let gifUrl: string | null = null;
    if (gifMatch) {
      const searchTerm = gifMatch[1].trim();
      gifUrl = await searchGif(searchTerm);
      // Remove the GIF marker from text, but keep some text if it becomes empty
      const textWithoutGif = textWithGifMarkers.replace(gifMatch[0], '').trim();
      responseText = textWithoutGif || ""; // Allow empty text when there's a GIF
    }

    // ============================================
    // STEP 4: Extract ONE THING from response
    // ============================================

    const oneThing = extractOneThing(rawResponse);
    if (oneThing) {
      console.log(`[CHAT] ONE THING extracted: "${oneThing}"`);
    }

    // ============================================
    // STEP 4.5: Check if Kagan is committing to create something
    // If so, call the agent to actually build it
    // ============================================

    // Check both: user asking for build AND Kagan confirming he'll build
    const userIntent = detectUserBuildIntent(message);
    const kaganIntent = detectKaganCreateIntent(rawResponse);

    // Trigger agent if either:
    // 1. Kagan explicitly says he's building (primary)
    // 2. User asked for build AND Kagan didn't refuse (fallback)
    const shouldCallAgent = kaganIntent.shouldCreate ||
      (userIntent.wantsBuild && !rawResponse.toLowerCase().includes("what kind") && !rawResponse.toLowerCase().includes("tell me more"));

    const createType = kaganIntent.type || (userIntent.wantsBuild ? 'build' : userIntent.wantsDoc ? 'document' : null);

    // Generate a unique build ID if we're going to build
    const buildId = shouldCallAgent && createType ? `build-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` : null;

    if (shouldCallAgent && createType && buildId) {
      console.log(`[CHAT] Create intent detected: ${createType} (user: ${userIntent.wantsBuild}, kagan: ${kaganIntent.shouldCreate})`);
      console.log(`[CHAT] Build ID: ${buildId}`);

      // Build context from conversation
      const recentContext = messageHistory
        .slice(-10)
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      // Fire agent request in background (don't await)
      // Store the promise so we can track it, but don't block
      const agentPromise = fetch(new URL('/api/agent', req.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: createType === 'build'
            ? 'Build a working prototype/demo based on the conversation. Deploy it and return the URL.'
            : 'Create a document based on the conversation. Use Kagan\'s principles.',
          context: recentContext,
          transcript: messageHistory,
          buildId, // Pass build ID for tracking
        }),
      });

      // Store the promise in module-level map for polling
      agentBuilds.set(buildId, {
        promise: agentPromise,
        status: 'building',
        startTime: Date.now(),
      });

      // Handle completion in background
      agentPromise.then(async (response) => {
        const data = await response.json();
        const buildEntry = agentBuilds.get(buildId);
        if (buildEntry) {
          buildEntry.status = 'complete';
          buildEntry.result = {
            deployedUrl: data.deployedUrl,
            document: data.document,
          };
        }
      }).catch((err) => {
        console.error('[CHAT] Agent build failed:', err);
        const buildEntry = agentBuilds.get(buildId);
        if (buildEntry) {
          buildEntry.status = 'error';
          buildEntry.error = err instanceof Error ? err.message : 'Unknown error';
        }
      });
    }

    // ============================================
    // STEP 5: SAVE AI RESPONSE TO THREAD
    // Zep will automatically extract facts from the conversation!
    // ============================================

    if (responseText && responseText.trim()) {
      try {
        await addMessages(threadId, [
          { role: "assistant", content: responseText, name: "Kagan" },
        ]);
      } catch (err) {
        console.error('[CHAT] Save failed:', err);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[CHAT] Total request time: ${totalTime}ms`);

    return NextResponse.json({
      response: responseText,
      threadId,
      artifact,
      gifUrl,
      oneThing, // Return extracted ONE THING for client to store
      isNewSession, // Tell client if this was a new session
      // Build tracking - client will poll for result
      buildId: buildId, // If set, client should poll for result
      isBuilding: !!buildId, // Flag for UI to show building indicator
    });
  } catch (error) {
    console.error("Chat error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to process chat: ${errorMessage}` },
      { status: 500 }
    );
  }
}
