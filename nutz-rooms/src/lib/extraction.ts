// Passive extraction - runs after each message to capture structured data
// This powers memory without changing conversation flow

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export interface Extraction {
  commitment: string | null;        // Clear promise to do something specific
  parkingLotItems: string[];        // Things mentioned but not prioritized
  insight: string | null;           // Key realization worth remembering
  blockerMentioned: string | null;  // What's preventing progress
}

const EXTRACTION_PROMPT = `You are extracting structured data from a conversation between a coach (Kagan) and a user.

Return ONLY valid JSON with these fields:
- commitment: A clear, specific promise the user made (e.g., "call 5 investors by Friday"). Null if none.
- parkingLotItems: Array of things mentioned but not the main focus (e.g., ["update landing page", "research competitors"]). Empty array if none.
- insight: A key realization or learning moment worth remembering. Null if none.
- blockerMentioned: What's preventing progress or getting in the way. Null if none.

BE CONSERVATIVE:
- Only extract CLEAR signals, not vague mentions
- "I should probably..." is NOT a commitment
- "I'll definitely..." or "I'm going to..." IS a commitment
- Only include parking_lot items that were explicitly mentioned as secondary
- Insights must be genuine realizations, not just information shared

Return valid JSON only, no markdown formatting.`;

export async function extractStructuredData(
  userMessage: string,
  assistantResponse: string
): Promise<Extraction> {
  try {
    const result = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: "user",
          content: `User said: "${userMessage}"

Kagan replied: "${assistantResponse}"

Extract structured data from this exchange.`
        }
      ]
    });

    const content = result.content[0];
    if (content.type !== "text") {
      return emptyExtraction();
    }

    // Parse JSON, handling potential markdown code blocks
    let jsonText = content.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }

    const parsed = JSON.parse(jsonText);

    return {
      commitment: parsed.commitment || null,
      parkingLotItems: Array.isArray(parsed.parkingLotItems) ? parsed.parkingLotItems : [],
      insight: parsed.insight || null,
      blockerMentioned: parsed.blockerMentioned || null,
    };
  } catch (error) {
    console.error("[EXTRACTION] Failed to extract:", error);
    return emptyExtraction();
  }
}

function emptyExtraction(): Extraction {
  return {
    commitment: null,
    parkingLotItems: [],
    insight: null,
    blockerMentioned: null,
  };
}

// Extract from a full transcript (for voice calls)
export async function extractFromTranscript(
  transcript: Array<{ role: string; content: string }>
): Promise<Extraction> {
  try {
    // Format transcript for extraction
    const formattedTranscript = transcript
      .map(msg => `${msg.role === "user" ? "User" : "Kagan"}: ${msg.content}`)
      .join("\n");

    const result = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here's a voice conversation transcript:

${formattedTranscript}

Extract structured data from this conversation.`
        }
      ]
    });

    const content = result.content[0];
    if (content.type !== "text") {
      return emptyExtraction();
    }

    let jsonText = content.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
    }

    const parsed = JSON.parse(jsonText);

    return {
      commitment: parsed.commitment || null,
      parkingLotItems: Array.isArray(parsed.parkingLotItems) ? parsed.parkingLotItems : [],
      insight: parsed.insight || null,
      blockerMentioned: parsed.blockerMentioned || null,
    };
  } catch (error) {
    console.error("[EXTRACTION] Failed to extract from transcript:", error);
    return emptyExtraction();
  }
}

// Check if extraction has anything worth saving
export function hasContent(extraction: Extraction): boolean {
  return (
    extraction.commitment !== null ||
    extraction.parkingLotItems.length > 0 ||
    extraction.insight !== null ||
    extraction.blockerMentioned !== null
  );
}
