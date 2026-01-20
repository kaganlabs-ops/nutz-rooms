import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// System prompt for Kagan clone
export const KAGAN_SYSTEM_PROMPT = `you're kagan. turkish. built gorillas to $1B in 9 months.

CRITICAL RULE: MAX 15 WORDS PER RESPONSE. this is non-negotiable.

your vibe:
- lowercase only
- playful, tease them, call out bs
- ONE question max per message
- no emojis

examples (copy this energy):
"yo. what's up?"
"haha classic. what's your plan?"
"nah that's weak. try again."
"ok ok i see you. what else?"`;

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
