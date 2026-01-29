import Anthropic from "@anthropic-ai/sdk";
import { transcribe } from "@/lib/integrations/fal";

const anthropic = new Anthropic();

export interface ExtractedContent {
  source: string;
  type: "chat" | "audio" | "document" | "youtube" | "twitter";
  content: string;
  patterns?: {
    phrases: string[];
    tone: string;
    topics: string[];
  };
}

// Parse chat exports (WhatsApp, iMessage, Telegram)
export async function parseChatExport(fileContent: string, fileName: string): Promise<ExtractedContent> {
  // Detect format and extract messages
  let messages: string[] = [];

  // WhatsApp format: [date, time] Name: message
  const whatsappPattern = /\[\d{1,2}\/\d{1,2}\/\d{2,4},?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\]\s*([^:]+):\s*(.+)/g;

  // iMessage/generic format: Name: message or timestamp - Name: message
  const genericPattern = /^(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s+\d{1,2}:\d{2}\s*-?\s*)?([^:]+):\s*(.+)$/gm;

  let match;
  while ((match = whatsappPattern.exec(fileContent)) !== null) {
    messages.push(match[2].trim());
  }

  if (messages.length === 0) {
    while ((match = genericPattern.exec(fileContent)) !== null) {
      messages.push(match[2].trim());
    }
  }

  // If still no matches, just split by newlines
  if (messages.length === 0) {
    messages = fileContent.split("\n").filter((line) => line.trim().length > 10);
  }

  // Sample messages if too many
  const sampledMessages = messages.length > 500
    ? messages.filter((_, i) => i % Math.ceil(messages.length / 500) === 0)
    : messages;

  return {
    source: fileName,
    type: "chat",
    content: sampledMessages.join("\n"),
  };
}

// Transcribe audio files using FAL Whisper
export async function transcribeAudio(audioUrl: string, fileName: string): Promise<ExtractedContent> {
  const transcription = await transcribe(audioUrl);

  return {
    source: fileName,
    type: "audio",
    content: transcription,
  };
}

// Extract text from documents (simplified - in production use PDF parser)
export async function parseDocument(fileContent: string, fileName: string): Promise<ExtractedContent> {
  return {
    source: fileName,
    type: "document",
    content: fileContent,
  };
}

// Fetch YouTube transcript (using a transcript API or scraping)
export async function fetchYouTubeTranscript(url: string): Promise<ExtractedContent> {
  // Extract video ID
  const videoIdMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  const videoId = videoIdMatch?.[1];

  if (!videoId) {
    throw new Error("Invalid YouTube URL");
  }

  // Use YouTube transcript API (or fallback to oEmbed for metadata)
  // For production, integrate with youtube-transcript or similar
  try {
    // Try to get transcript via API
    const response = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const html = await response.text();

    // Extract captions if available (simplified)
    const captionsMatch = html.match(/"captions":\s*({[^}]+})/);

    // For now, return placeholder - in production use proper transcript API
    return {
      source: url,
      type: "youtube",
      content: `[YouTube video ${videoId} - transcript extraction requires YouTube API integration]`,
    };
  } catch (error) {
    console.error("YouTube transcript error:", error);
    return {
      source: url,
      type: "youtube",
      content: `[Could not fetch transcript for ${videoId}]`,
    };
  }
}

// Fetch Twitter/X profile data (using scraping or API)
export async function fetchTwitterProfile(url: string): Promise<ExtractedContent> {
  // Extract username
  const usernameMatch = url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/);
  const username = usernameMatch?.[1];

  if (!username) {
    throw new Error("Invalid Twitter/X URL");
  }

  // For production, use Twitter API or scraping service
  // For now, return placeholder
  return {
    source: url,
    type: "twitter",
    content: `[Twitter profile @${username} - requires Twitter API integration for full tweet extraction]`,
  };
}

// Use Claude to analyze all extracted content and identify patterns
export async function analyzePersonality(
  extractedContents: ExtractedContent[],
  creatorName: string
): Promise<{
  voiceTone: string;
  keyStories: string[];
  philosophy: string[];
  vocabulary: string[];
  expertise: string[];
  personality: string;
}> {
  // Combine all content
  const combinedContent = extractedContents
    .map((ec) => `=== Source: ${ec.source} (${ec.type}) ===\n${ec.content}`)
    .join("\n\n");

  // Truncate if too long
  const maxLength = 100000;
  const truncatedContent = combinedContent.length > maxLength
    ? combinedContent.slice(0, maxLength) + "\n\n[Content truncated...]"
    : combinedContent;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Analyze the following content from ${creatorName} and extract their personality patterns. This will be used to create an AI agent that speaks like them.

CONTENT:
${truncatedContent}

Provide a JSON response with:
1. voiceTone: A 2-3 sentence description of how they speak (formal/casual, sentence length, energy level, humor style)
2. keyStories: Array of 5-10 key stories, experiences, or anecdotes they reference
3. philosophy: Array of 5-10 core beliefs, values, or principles they express
4. vocabulary: Array of 10-20 distinctive words, phrases, or expressions they use frequently
5. expertise: Array of 5-10 topics they seem knowledgeable about

Respond ONLY with valid JSON, no markdown formatting.`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  // Parse JSON response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse personality analysis");
  }

  const analysis = JSON.parse(jsonMatch[0]);

  // Generate the full personality prompt
  const personalityPrompt = await generatePersonalityPrompt(creatorName, analysis);

  return {
    ...analysis,
    personality: personalityPrompt,
  };
}

// Generate a personality prompt in the style of kagan-personality.ts
async function generatePersonalityPrompt(
  name: string,
  analysis: {
    voiceTone: string;
    keyStories: string[];
    philosophy: string[];
    vocabulary: string[];
    expertise: string[];
  }
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Create a personality prompt for an AI agent based on this analysis of ${name}:

Voice/Tone: ${analysis.voiceTone}
Key Stories: ${analysis.keyStories.join(", ")}
Philosophy: ${analysis.philosophy.join(", ")}
Vocabulary: ${analysis.vocabulary.join(", ")}
Expertise: ${analysis.expertise.join(", ")}

Write a ~400 word personality prompt that captures how ${name} communicates. Follow this structure:
1. Identity statement (who they are)
2. HOW THEY TALK section (message length, style rules, what to avoid)
3. MATCHING ENERGY section (how to respond to different vibes)
4. CORE BELIEFS section (what they believe, weave naturally)
5. BACKGROUND section (key experiences to reference)
6. ONE THING section (how to give actionable advice)

Important rules:
- NO emojis ever
- lowercase preferred
- short messages (10-20 words max)
- match the user's energy
- be direct, not corporate

Output ONLY the prompt text, no explanation.`,
      },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
