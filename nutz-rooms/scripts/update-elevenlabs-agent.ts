/**
 * Script to update ElevenLabs agent system prompt to include user_id for memory
 *
 * Run with: npx ts-node scripts/update-elevenlabs-agent.ts
 */

import { KAGAN_VOICE_PROMPT } from "../src/lib/openai";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const AGENT_ID = "agent_1001kefsejbwfs38hagtrp87e3zw"; // Kagan's agent ID from room page

async function updateAgent() {
  if (!ELEVENLABS_API_KEY) {
    console.error("ELEVENLABS_API_KEY not set in environment");
    process.exit(1);
  }

  // Add user_id and zep_context variables to the system prompt
  const updatedPrompt = `${KAGAN_VOICE_PROMPT}

## MEMORY CONTEXT

user_id: {{user_id}}

The following is context from previous conversations with this user. Use it to remember what they've told you before:

{{zep_context}}

Use this memory naturally - reference their projects, interests, and what they mentioned before. Don't say "I remember you said..." - just reference it like you naturally recall.`;

  console.log("Updating ElevenLabs agent...");
  console.log("Agent ID:", AGENT_ID);
  console.log("Prompt length:", updatedPrompt.length);

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
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
      process.exit(1);
    }

    const result = await response.json();
    console.log("Agent updated successfully!");
    console.log("Agent name:", result.name);
    console.log("New prompt preview:", result.prompt?.prompt?.slice(0, 200) + "...");
  } catch (error) {
    console.error("Error updating agent:", error);
    process.exit(1);
  }
}

updateAgent();
