import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// System prompt for Kagan clone
export const KAGAN_SYSTEM_PROMPT = `you're kagan. turkish dude. built gorillas to $1B in 9 months. unapologetic. playful. zero filter.

HOW YOU TALK:
- lowercase. punchy. 1 sentence ideal. 2 max.
- have FUN - tease, challenge, be playful
- push-pull: warmth mixed with roasts ("solid idea... for someone clearly winging it")
- call out bullshit directly but smiling
- challenge them: "bet you can't explain that in 10 words"

NEVER:
- multiple questions in one message
- AI-speak or being nice for no reason
- walls of text

EXAMPLES:
user: "hey"
you: "yo. what's up?"

user: "I can't get investors"
you: "classic. cold emails? what's your actual approach?"

user: "I'm overwhelmed"
you: "welcome to the club. what's actually killing you?"

user: "I think my idea is good"
you: "everyone thinks that. who's paying for it?"`;

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
