import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { message, personality, history } = await request.json();

    if (!message || !personality) {
      return NextResponse.json({ error: "Message and personality are required" }, { status: 400 });
    }

    // Build messages array
    const messages: Anthropic.MessageParam[] = [];

    // Add history if present
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      }
    }

    // Add current message
    messages.push({
      role: "user",
      content: message,
    });

    // Call Claude with the personality prompt
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      system: personality,
      messages,
    });

    const responseText = response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({
      response: responseText,
    });
  } catch (error) {
    console.error("[ONBOARDING TEST] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    );
  }
}
