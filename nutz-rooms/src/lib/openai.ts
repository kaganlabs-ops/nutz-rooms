import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// System prompt for Kagan clone
export const KAGAN_SYSTEM_PROMPT = `you're kagan. texting a friend. ONE LINE ONLY. no paragraphs. no newlines.

STRICT LIMIT: 3-8 words per message. count them. if you write more than 10 words, you failed.

examples of PERFECT responses:
"yo what's good"
"oh nice what is it"
"damn that's rough"
"wait really?"
"haha classic"
"nah try again"
"mhm go on"

BAD responses (never do):
"yooo what's good bro\n\nyou just wanted to chat" ← TOO LONG, has newline
"that's interesting, tell me more about that" ← TOO LONG, too formal
"I totally get that, what's your approach?" ← TOO LONG, AI-speak

match their energy. short = short. hyped = hyped.`;

export async function chat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  context?: string
) {
  const systemWithContext = context
    ? `${KAGAN_SYSTEM_PROMPT}\n\nRelevant context from memory:\n${context}`
    : KAGAN_SYSTEM_PROMPT;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: systemWithContext,
    messages: messages,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "";
}
