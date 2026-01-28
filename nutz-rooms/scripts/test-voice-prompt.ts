/**
 * Test voice prompt - Multi-turn conversations
 * Shows full user-facing conversation threads
 */

import Anthropic from "@anthropic-ai/sdk";
import { getKaganPrompt } from "../src/lib/agent/prompts/kagan-personality";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const systemPrompt = getKaganPrompt("voice");

interface Message {
  role: "user" | "assistant";
  content: string;
}

async function chat(messages: Message[]): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 150,
    system: systemPrompt,
    messages,
  });
  return response.content[0]?.type === "text" ? response.content[0].text : "";
}

async function runConversation(name: string, userMessages: string[]) {
  console.log("\n" + "=".repeat(60));
  console.log(`CONVERSATION: ${name}`);
  console.log("=".repeat(60));

  const history: Message[] = [];

  for (const userMsg of userMessages) {
    // Add user message
    history.push({ role: "user", content: userMsg });
    console.log(`\n👤 User: ${userMsg}`);

    // Get Kagan's response
    const response = await chat(history);
    history.push({ role: "assistant", content: response });
    console.log(`🦍 Kagan: ${response}`);
  }

  return history;
}

async function main() {
  console.log(`\nUsing NEW prompt (${systemPrompt.length} chars)\n`);

  // Conversation 1: Casual greeting into startup chat
  await runConversation("Casual → Startup", [
    "yo",
    "not much, just thinking about stuff",
    "I've been wanting to start something but idk what",
    "I have a few ideas but they all seem hard",
  ]);

  // Conversation 2: Overwhelmed founder
  await runConversation("Overwhelmed Founder", [
    "dude I'm so stressed with my startup",
    "everything. fundraising, product, team. it's all falling apart",
    "we have like 3 months of runway and no traction",
  ]);

  // Conversation 3: Gorillas deep dive
  await runConversation("Gorillas Story", [
    "how did you come up with the idea for gorillas",
    "wait you started with negative money?",
    "how did you convince people to join when you had nothing",
  ]);

  // Conversation 4: Workout request
  await runConversation("Workout Help", [
    "yo I need to get in shape",
    "just general fitness, I've been sitting at my desk too much",
    "yeah that'd be helpful",
  ]);

  // Conversation 5: Perfectionist
  await runConversation("Perfectionist Loop", [
    "I've been working on my app for a year and it's still not ready",
    "I keep finding things to fix before I can launch",
    "but what if people hate it",
  ]);

  // Conversation 6: Multiple ideas
  await runConversation("Too Many Ideas", [
    "I have like 5 startup ideas I'm working on",
    "but they're all good opportunities",
    "ok fine. probably the marketplace one",
  ]);

  console.log("\n" + "=".repeat(60));
  console.log("DONE - All conversations complete");
  console.log("=".repeat(60) + "\n");
}

main().catch(console.error);
