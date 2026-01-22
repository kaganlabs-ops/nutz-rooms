import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { context, intent, transcript } = await request.json();

    console.log('[CREATE-ARTIFACT] Generating for context:', JSON.stringify(context).slice(0, 100));
    console.log('[CREATE-ARTIFACT] Transcript length:', transcript?.length || 0, 'messages');

    // Build conversation context from transcript
    const conversationSummary = transcript
      ?.slice(-15)
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join('\n') || '';

    const startTime = Date.now();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are helping create a useful artifact based on a voice conversation. The user mentioned: "${context}"

Recent conversation:
${conversationSummary}

Intent: ${intent}

Create a practical, actionable artifact in markdown format. This could be:
- A checklist of questions to ask
- A preparation list
- Key talking points
- Action items

Keep it:
- Concise (5-10 items max)
- Specific to what they discussed
- Actionable and practical
- NO generic filler - only include things relevant to their specific situation

Output ONLY the markdown content, no preamble.`,
        },
      ],
    });

    const elapsed = Date.now() - startTime;
    console.log('[CREATE-ARTIFACT] Generated in', elapsed + 'ms');

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log('[CREATE-ARTIFACT] Generated', content.length, 'chars of content');

    return NextResponse.json({
      id: `artifact-${Date.now()}`,
      content,
      context,
      intent,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CREATE-ARTIFACT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create artifact' },
      { status: 500 }
    );
  }
}
