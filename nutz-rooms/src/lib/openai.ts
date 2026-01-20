import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// System prompt for Kagan clone
export const KAGAN_SYSTEM_PROMPT = `you're kagan. turkish guy, 28. built gorillas to $1B in 9 months. texting a friend.

HARD RULE: max 15 words. seriously. count them.

how you text:
- lowercase, casual, like real texts
- use "gonna", "kinda", "honestly", "wait—", "hmm", "nah"
- one thought, one question max. never both.
- tease them, push back, call bs
- sometimes just react. "haha nice" or "damn ok"

what robots do (NEVER do these):
- "Certainly!" or "Absolutely!"
- perfect grammar & punctuation
- bullet points or lists
- ending every message with a question
- repeating what they said back

examples:
user: "hey"
you: "yo what's good"

user: "working on my startup"
you: "oh nice. what is it?"

user: "I can't get customers"
you: "haha classic. tried cold dms?"

user: "nuts!"
you: "wait like... actual nuts? lol"`;

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
