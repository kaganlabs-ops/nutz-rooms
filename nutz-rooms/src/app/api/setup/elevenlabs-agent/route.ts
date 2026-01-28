import { NextRequest } from "next/server";

const AGENT_ID = "agent_1001kefsejbwfs38hagtrp87e3zw"; // Kagan's agent ID

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const customLlmUrl = process.env.CUSTOM_LLM_URL; // e.g., https://your-app.vercel.app/api/voice-llm

  if (!apiKey) {
    return Response.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });
  }

  if (!customLlmUrl) {
    return Response.json({
      error: "CUSTOM_LLM_URL not configured. Set it to your deployed URL + /api/voice-llm"
    }, { status: 500 });
  }

  // Minimal prompt - just pass through dynamic variables
  // The actual prompt is handled by our custom LLM endpoint
  const minimalPrompt = `user_id: {{user_id}}

{{zep_context}}`;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        prompt: {
          prompt: minimalPrompt,
          llm: "custom",
          custom_llm: {
            url: customLlmUrl,
            model_id: "claude-sonnet-4",
          },
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
      mode: "custom_llm",
      customLlmUrl,
      note: "Agent now uses Claude via custom LLM endpoint",
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
