import { NextRequest } from "next/server";
import { ensureUser, createThread, addMessages } from "@/lib/zep";

// API endpoint to save voice call transcripts to Zep
// This allows voice conversations to be remembered in future sessions
export async function POST(req: NextRequest) {
  try {
    const { userId, messages } = await req.json();

    if (!userId || !messages || messages.length === 0) {
      return Response.json({ error: "userId and messages required" }, { status: 400 });
    }

    console.log(`[VOICE-SAVE] Saving ${messages.length} messages for user ${userId}`);

    // Ensure user exists
    await ensureUser(userId);

    // Create a new thread for this voice session
    const threadId = await createThread(userId);
    console.log(`[VOICE-SAVE] Created thread: ${threadId}`);

    // Format messages for Zep
    const zepMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" as const : "assistant" as const,
      content: m.content,
      name: m.role === "user" ? "User" : "Kagan",
    }));

    // Save all messages to the thread
    await addMessages(threadId, zepMessages);
    console.log(`[VOICE-SAVE] Saved ${zepMessages.length} messages to thread`);

    // Zep will automatically extract facts from these messages!
    // The next time getUserContext is called, these facts will be available

    return Response.json({
      success: true,
      threadId,
      messageCount: messages.length,
    });
  } catch (error) {
    console.error("[VOICE-SAVE] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to save" },
      { status: 500 }
    );
  }
}
