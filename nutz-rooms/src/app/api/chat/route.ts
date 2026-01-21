import { NextRequest, NextResponse } from "next/server";
import { ensureUser, createThread, addMessages, getThreadMessages, getUserContext, hasRealMemory } from "@/lib/zep";
import { anthropic, KAGAN_SYSTEM_PROMPT } from "@/lib/openai";
import { parseArtifact } from "@/lib/artifacts";
import { searchGif } from "@/lib/giphy";
import { findRelevantFacts, formatBrainContext, getKaganBrain } from "@/lib/brain";

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const { message, threadId: existingThreadId, userId } = await req.json();

    if (!message || !userId) {
      return NextResponse.json(
        { error: "Message and userId are required" },
        { status: 400 }
      );
    }

    console.log(`[CHAT] Request from user: ${userId}`);

    // ============================================
    // STEP 1: Setup user and thread
    // ============================================

    await ensureUser(userId);
    let threadId = existingThreadId;
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
    // BUILD CONTEXT: Combine brain + Zep memory
    // ============================================

    // Get relevant facts from Kagan's brain based on message
    const relevantBrainFacts = findRelevantFacts(message, 8);

    // Build system prompt with combined context
    let systemPrompt = KAGAN_SYSTEM_PROMPT;

    // Add Kagan's brain (shared knowledge about Kagan)
    if (relevantBrainFacts.length > 0) {
      systemPrompt += `\n\n${formatBrainContext(relevantBrainFacts)}`;
    }

    // Add user memory from Zep (this is the KEY part)
    // Zep returns pre-formatted context - inject it directly
    // Check if there's REAL content (not just empty template)
    const hasUserSummary = memoryContext?.includes('<USER_SUMMARY>') &&
                           !memoryContext.includes('No other personal or lifestyle details are currently known');
    const hasRealFacts = memoryContext?.includes('<FACTS>') &&
                         !memoryContext.match(/<FACTS>\s*<\/FACTS>/) &&
                         !memoryContext.match(/<FACTS>\s*\n\s*<\/FACTS>/);
    const hasRealMemory = hasUserSummary || hasRealFacts;

    console.log(`[CHAT] Memory analysis: hasUserSummary=${hasUserSummary}, hasRealFacts=${hasRealFacts}, hasRealMemory=${hasRealMemory}`);

    console.log(`[CHAT] Memory check: hasRealMemory=${hasRealMemory}, length=${memoryContext?.length || 0}`);

    if (hasRealMemory) {
      systemPrompt += `\n\n## MEMORY - What I know about this user:
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
    } else {
      systemPrompt += `\n\n## MEMORY:
NO MEMORY AVAILABLE. This is a new user or I have no context from past conversations.

CRITICAL:
- Do NOT make up or hallucinate past conversations
- If user asks "what did I tell you last time" - say "i dont have context from our last convo, whats up?"
- Be direct: "im not seeing our past convos, fill me in"`;
    }

    console.log(`[CHAT] Context: ${relevantBrainFacts.length} brain facts, memory context: ${memoryContext ? 'yes' : 'no'}`);

    // ============================================
    // STEP 2: CALL CLAUDE (stream to user)
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
    // STEP 3: SAVE AI RESPONSE TO THREAD
    // Zep will automatically extract facts from the conversation!
    // No need to manually extract and save facts.
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

