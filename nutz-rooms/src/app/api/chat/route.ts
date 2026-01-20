import { NextRequest, NextResponse } from "next/server";
import { ensureUser, createThread, addMessages, getThreadMessages, searchGraph, addToGraph } from "@/lib/zep";
import { anthropic, KAGAN_SYSTEM_PROMPT } from "@/lib/openai";
import { parseArtifact } from "@/lib/artifacts";

export async function POST(req: NextRequest) {
  try {
    const { message, threadId: existingThreadId, userId } = await req.json();

    if (!message || !userId) {
      return NextResponse.json(
        { error: "Message and userId are required" },
        { status: 400 }
      );
    }

    // Ensure user exists in Zep
    await ensureUser(userId);

    // Get or create thread
    let threadId = existingThreadId;
    if (!threadId) {
      threadId = await createThread(userId);
    }

    // Add user message to Zep thread
    await addMessages(threadId, [
      { role: "user", content: message, name: "User" },
    ]);

    // Get message history from thread (last 10 messages)
    const threadMessages = await getThreadMessages(threadId);
    const messageHistory: Array<{ role: "user" | "assistant"; content: string }> = [];

    const recentMessages = threadMessages.slice(-10);
    for (const msg of recentMessages) {
      if (msg.role === "user" || msg.role === "assistant") {
        messageHistory.push({
          role: msg.role,
          content: msg.content || "",
        });
      }
    }

    // Search for relevant memories
    let memories: string[] = [];
    const memoryResults = await searchGraph(userId, message);
    if (memoryResults?.edges) {
      memories = memoryResults.edges
        .map((e: { fact?: string }) => e.fact)
        .filter((f): f is string => Boolean(f))
        .slice(0, 10);
    }

    // Build system prompt with memories
    let systemPrompt = KAGAN_SYSTEM_PROMPT;
    if (memories.length > 0) {
      systemPrompt += `\n\n## Context from memory:\n${memories.join('\n')}`;
    }

    // Call Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [...messageHistory, { role: "user", content: message }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const rawResponse = textBlock?.type === "text" ? textBlock.text : "";

    // Parse artifacts from response
    const { text: responseText, artifact } = parseArtifact(rawResponse);

    // Add AI response to Zep thread
    await addMessages(threadId, [
      { role: "assistant", content: responseText, name: "Kagan" },
    ]);

    // Save facts to Zep in background (non-blocking)
    extractAndSaveFacts(userId, message).catch(err =>
      console.error('[CHAT] Background fact save failed:', err)
    );

    return NextResponse.json({
      response: responseText,
      threadId,
      artifact,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to process chat" },
      { status: 500 }
    );
  }
}

// Extract facts from message and save to Zep
async function extractAndSaveFacts(userId: string, message: string): Promise<void> {
  const importantPatterns = [
    /i(?:'m| am) building (.+)/i,
    /my (?:startup|company|project) is (.+)/i,
    /i work (?:on|at) (.+)/i,
    /my name is (.+)/i,
    /i(?:'m| am) a (.+)/i,
    /i founded (.+)/i,
  ];

  for (const pattern of importantPatterns) {
    const match = message.match(pattern);
    if (match) {
      await addToGraph(userId, `User fact: ${match[0]}`);
      break;
    }
  }
}
