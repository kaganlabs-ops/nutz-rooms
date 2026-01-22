import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const ARTIFACT_GENERATION_PROMPT = `Based on this conversation, create a single page that helps the user.

You decide the format. Options:
- Checklist (things to check/verify)
- Questions to ask (for meetings, viewings, interviews)
- Script/talking points (for difficult conversations)
- Pros and cons (for decisions)
- Action steps (sequential tasks)
- Summary (key points to remember)
- Whatever combination fits

RULES:
- Use ONLY what was discussed in the conversation
- Don't add generic advice they didn't ask for
- Keep it short and actionable
- Make it specific to THIS user, THIS situation
- Use markdown formatting
- No intro/outro text like "Here's what I put together" - just the content

Return ONLY the markdown content, nothing else.`;

interface CreateArtifactRequest {
  context: string; // What this is about (e.g., "apartment viewing")
  intent: string; // What user wants to accomplish
  transcript: Array<{ role: string; content: string }>;
}

export async function POST(req: NextRequest) {
  try {
    const { context, intent, transcript } = (await req.json()) as CreateArtifactRequest;

    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return NextResponse.json(
        { error: "transcript is required" },
        { status: 400 }
      );
    }

    console.log(`[CREATE-ARTIFACT] Generating for context: "${context}", intent: "${intent}"`);
    console.log(`[CREATE-ARTIFACT] Transcript length: ${transcript.length} messages`);

    // Format transcript for Claude
    const formattedTranscript = transcript
      .map(msg => `${msg.role === 'user' ? 'User' : 'Kagan'}: ${msg.content}`)
      .join('\n');

    // Build the request for Claude
    const userPrompt = `Context: ${context || 'General assistance'}
Intent: ${intent || 'Help the user'}

CONVERSATION:
${formattedTranscript}

Create a helpful page based on this conversation.`;

    const startTime = Date.now();

    const result = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: ARTIFACT_GENERATION_PROMPT,
      messages: [
        { role: "user", content: userPrompt }
      ]
    });

    const elapsed = Date.now() - startTime;
    console.log(`[CREATE-ARTIFACT] Generated in ${elapsed}ms`);

    const content = result.content[0];
    if (content.type !== "text") {
      return NextResponse.json(
        { error: "Unexpected response format" },
        { status: 500 }
      );
    }

    const markdown = content.text.trim();
    console.log(`[CREATE-ARTIFACT] Generated ${markdown.length} chars of content`);

    return NextResponse.json({
      id: `artifact-${Date.now()}`,
      content: markdown,
      context,
      intent,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CREATE-ARTIFACT] Error:", error);
    return NextResponse.json(
      { error: "Failed to create artifact" },
      { status: 500 }
    );
  }
}
