import { NextRequest, NextResponse } from "next/server";
import { ensureUser, createThread, addMessages, getThreadMessages, getUserMemory, saveUserMemory, formatUserMemoryContext } from "@/lib/zep";
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
    // STEP 1: PARALLEL FETCH (before Claude)
    // - Kagan's brain (cached, instant)
    // - User's memory (from Zep, ~150ms)
    // - Thread setup (if needed)
    // ============================================

    // Start parallel operations
    const [
      _brainPreload,        // Just to ensure cache is warm
      userMemories,         // User's personal memories
      threadSetup,          // Ensure user + thread exists
    ] = await Promise.all([
      // 1. Kagan's brain - instant from cache
      Promise.resolve(getKaganBrain()),

      // 2. User's memory from Zep (fetch 10 to get more context across sessions)
      getUserMemory(userId, message, 10),

      // 3. Setup: ensure user exists + get/create thread
      (async () => {
        await ensureUser(userId);
        let threadId = existingThreadId;
        if (!threadId) {
          threadId = await createThread(userId);
        }
        return threadId;
      })(),
    ]);

    const threadId = threadSetup;
    const parallelTime = Date.now() - startTime;
    console.log(`[CHAT] Parallel fetch completed in ${parallelTime}ms`);
    console.log(`[CHAT] User memories fetched:`, userMemories.length, userMemories.slice(0, 3));

    // Add user message to thread (for history)
    await addMessages(threadId, [
      { role: "user", content: message, name: "User" },
    ]);

    // Get conversation history
    const threadMessages = await getThreadMessages(threadId);
    const messageHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
    const recentMessages = threadMessages.slice(-10);
    for (const msg of recentMessages) {
      // Only include messages with actual content (Claude API requires non-empty content)
      if ((msg.role === "user" || msg.role === "assistant") && msg.content && msg.content.trim()) {
        messageHistory.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // ============================================
    // BUILD CONTEXT: Combine brain + user memory
    // ============================================

    // Get relevant facts from Kagan's brain based on message
    const relevantBrainFacts = findRelevantFacts(message, 8);

    // Build system prompt with combined context
    let systemPrompt = KAGAN_SYSTEM_PROMPT;

    // Add Kagan's brain (shared knowledge)
    if (relevantBrainFacts.length > 0) {
      systemPrompt += `\n\n${formatBrainContext(relevantBrainFacts)}`;
    }

    // Add user's personal memory
    if (userMemories.length > 0) {
      systemPrompt += `\n\n${formatUserMemoryContext(userMemories)}`;
    }

    console.log(`[CHAT] Context: ${relevantBrainFacts.length} brain facts, ${userMemories.length} user memories`);

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
    // STEP 3: SAVE TO MEMORY (quick, ~100ms)
    // - Save AI response to thread
    // - Extract and save user facts to USER memory only
    // ============================================

    const saveTasks: Promise<unknown>[] = [];

    // Save AI response to thread (only if there's actual text content)
    if (responseText && responseText.trim()) {
      saveTasks.push(
        addMessages(threadId, [
          { role: "assistant", content: responseText, name: "Kagan" },
        ])
      );
    }

    // Extract and save facts to USER's memory (not Kagan's brain)
    saveTasks.push(extractAndSaveUserFacts(userId, message, responseText));

    // Wait for saves (must await or serverless kills it)
    try {
      await Promise.all(saveTasks);
    } catch (err) {
      console.error('[CHAT] Save failed:', err);
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

// Extract facts from user message and AI response, save to USER's memory only
async function extractAndSaveUserFacts(userId: string, userMessage: string, aiResponse: string): Promise<void> {
  console.log(`[EXTRACT] Starting extraction for user ${userId}, message: "${userMessage.slice(0, 50)}..."`);
  const factsToSave: string[] = [];

  // Patterns to extract from user message
  // Note: i(?:'m|m| am) handles "i'm", "im", "i am"
  const userPatterns = [
    { pattern: /i(?:'m|m| am) building (.+)/i, template: "User is building: $1" },
    { pattern: /my (?:startup|company|project|app) is (?:called )?(.+)/i, template: "User's project: $1" },
    { pattern: /i work (?:on|at|for) (.+)/i, template: "User works at/on: $1" },
    { pattern: /my name is (.+)/i, template: "User's name: $1" },
    { pattern: /i(?:'m|m| am) a (.+?)(?:\.|,|$)/i, template: "User is a: $1" },
    { pattern: /i founded (.+)/i, template: "User founded: $1" },
    { pattern: /i have (\d+) (?:users|customers)/i, template: "User has $1 users/customers" },
    { pattern: /we(?:'ve| have) raised (.+)/i, template: "User raised: $1" },
    { pattern: /i(?:'m|m| am) (?:feeling |)(?:stuck|overwhelmed|lost|stressed)/i, template: "User mentioned feeling stuck/overwhelmed" },
    { pattern: /my (?:biggest |main )?(?:problem|challenge|issue) is (.+)/i, template: "User's main challenge: $1" },
    { pattern: /(?:building|working on|making) (?:a |an )?(.+? (?:app|platform|tool|startup|company|product|saas|service))/i, template: "User is building: $1" },
  ];

  for (const { pattern, template } of userPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      const fact = template.replace('$1', match[1]?.trim() || match[0]);
      console.log(`[EXTRACT] Pattern matched: ${pattern} -> "${fact}"`);
      factsToSave.push(fact);
    }
  }

  console.log(`[EXTRACT] Total facts found: ${factsToSave.length}`);

  // Save extracted facts (max 3 per message to avoid noise)
  const factsToActuallySave = factsToSave.slice(0, 3);
  for (const fact of factsToActuallySave) {
    console.log(`[EXTRACT] Saving fact to Zep: "${fact}"`);
    const success = await saveUserMemory(userId, fact);
    console.log(`[EXTRACT] Save result: ${success}`);
  }

  if (factsToActuallySave.length > 0) {
    console.log(`[CHAT] Saved ${factsToActuallySave.length} facts to user memory: ${factsToActuallySave.join(', ')}`);
  } else {
    console.log(`[EXTRACT] No facts to save for this message`);
  }
}
