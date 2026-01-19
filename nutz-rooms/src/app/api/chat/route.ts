import { NextRequest, NextResponse } from "next/server";
import { ensureUser, createThread, addMessages, getThreadMessages } from "@/lib/zep";
import { orchestrator } from "@/lib/orchestrator";

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

    // Use orchestrator to process the conversation
    const result = await orchestrator.process({
      userId,
      message,
      messageHistory,
    });

    // Add AI response to Zep thread
    await addMessages(threadId, [
      { role: "assistant", content: result.response, name: "Kagan" },
    ]);

    return NextResponse.json({
      response: result.response,
      threadId,
      mode: result.modeState?.mode || null,
      stage: result.modeState?.currentStage || null,
      modeChanged: result.modeChanged,
      stageAdvanced: result.stageAdvanced,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to process chat" },
      { status: 500 }
    );
  }
}
