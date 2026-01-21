import { NextRequest } from "next/server";
import { KAGAN_VOICE_PROMPT } from "@/lib/openai";

const AGENT_ID = "agent_1001kefsejbwfs38hagtrp87e3zw"; // Kagan's agent ID

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });
  }

  // Add user_id and zep_context variables to the system prompt
  const updatedPrompt = `${KAGAN_VOICE_PROMPT}

## MEMORY CONTEXT

user_id: {{user_id}}

The following is context from previous conversations with this user. Use it to remember what they've told you before:

{{zep_context}}

Use this memory naturally - reference their projects, interests, and what they mentioned before. Don't say "I remember you said..." - just reference it like you naturally recall.`;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        prompt: {
          prompt: updatedPrompt,
          llm: "gpt-4o-mini",
          temperature: 0.7,
          max_tokens: 150,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to update agent:", response.status, error);
      return Response.json({ error: `ElevenLabs API error: ${error}` }, { status: response.status });
    }

    const result = await response.json();
    return Response.json({
      success: true,
      agentId: AGENT_ID,
      agentName: result.name,
      promptLength: updatedPrompt.length,
      promptPreview: updatedPrompt.slice(-500), // Show the memory context part
    });
  } catch (error) {
    console.error("Error updating agent:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update agent" },
      { status: 500 }
    );
  }
}

// GET to check current agent config
export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: `ElevenLabs API error: ${error}` }, { status: response.status });
    }

    const result = await response.json();
    return Response.json({
      agentId: AGENT_ID,
      agentName: result.name,
      currentPrompt: result.prompt?.prompt || "No prompt set",
      promptLength: result.prompt?.prompt?.length || 0,
      llm: result.prompt?.llm,
      hasUserIdVariable: result.prompt?.prompt?.includes("{{user_id}}") || false,
      hasZepContextVariable: result.prompt?.prompt?.includes("{{zep_context}}") || false,
    });
  } catch (error) {
    console.error("Error fetching agent:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch agent" },
      { status: 500 }
    );
  }
}
