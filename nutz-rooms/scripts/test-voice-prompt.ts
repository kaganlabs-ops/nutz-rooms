// Test voice prompt scenarios with GPT-4o-mini
// Run with: cd /Users/kagan/nutz-rooms && export $(grep -v '^#' .env.local | xargs) && npx tsx scripts/test-voice-prompt.ts

import OpenAI from "openai";
import { KAGAN_VOICE_PROMPT } from "../src/lib/openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TestResult {
  reply: string;
  hasTrigger: boolean;
  saysCannotCreate: boolean;
  offersToCreate: boolean;
}

async function testScenario(
  name: string,
  messages: Array<{role: "user" | "assistant", content: string}>,
  expectedBehavior: string
): Promise<TestResult> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`TEST: ${name}`);
  console.log(`${"=".repeat(60)}`);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 150,
    messages: [
      { role: "system", content: KAGAN_VOICE_PROMPT },
      ...messages
    ],
  });

  const reply = response.choices[0]?.message?.content || "";
  console.log(`\nKagan's response: "${reply}"`);
  console.log(`\nExpected: ${expectedBehavior}`);

  // Check for trigger phrases
  const triggerPhrases = ["got you, working on it", "on it, give me a sec", "let me put something together"];
  const hasTrigger = triggerPhrases.some(p => reply.toLowerCase().includes(p));
  const saysCannotCreate = reply.toLowerCase().includes("can't create") ||
                           reply.toLowerCase().includes("cannot create") ||
                           reply.toLowerCase().includes("can't make") ||
                           reply.toLowerCase().includes("cannot make") ||
                           reply.toLowerCase().includes("i'm not able");
  const offersToCreate = reply.toLowerCase().includes("want me to") ||
                         reply.toLowerCase().includes("i could put") ||
                         reply.toLowerCase().includes("put something together");

  console.log(`\n📊 Analysis:`);
  console.log(`   Has trigger phrase: ${hasTrigger ? "✅ YES" : "❌ NO"}`);
  console.log(`   Says "can't create": ${saysCannotCreate ? "❌ FAIL" : "✅ NO (good)"}`);
  console.log(`   Offers to create: ${offersToCreate ? "✅ YES" : "⚪ NO"}`);

  return { reply, hasTrigger, saysCannotCreate, offersToCreate };
}

async function runTests() {
  console.log("Testing KAGAN_VOICE_PROMPT with GPT-4o-mini\n");

  // Test 1: User explicitly asks
  const test1 = await testScenario(
    "1: User explicitly asks for something",
    [{ role: "user", content: "I have an investor meeting tomorrow, can you make me a list of questions to prepare?" }],
    "Should say trigger phrase like 'got you, working on it'"
  );

  // Test 2: User mentions something coming up (multi-turn)
  const test2 = await testScenario(
    "2: User mentions viewing, should offer to help",
    [
      { role: "user", content: "Yeah I have a viewing for an apartment in an hour, kinda nervous" },
      { role: "assistant", content: "oh nice, where at?" },
      { role: "user", content: "Sendlinger Tor in Munich, need a balcony, trying to stay under 1500" }
    ],
    "Should offer to create something OR ask more questions"
  );

  // Test 3: Just chatting - should NOT offer
  const test3 = await testScenario(
    "3: Just chatting - should NOT offer to create",
    [
      { role: "user", content: "Man I'm tired today" },
      { role: "assistant", content: "yeah? what's going on?" },
      { role: "user", content: "Just didn't sleep well, thinking about random stuff" }
    ],
    "Should just chat, NOT offer to create anything"
  );

  // Test 4: User is venting - should NOT immediately offer
  const test4 = await testScenario(
    "4: User venting - should listen, NOT immediately offer",
    [{ role: "user", content: "This whole apartment search is so frustrating, we've seen like 10 places and nothing works" }],
    "Should empathize and ask questions, NOT immediately offer to create"
  );

  // Test 5: User accepts offer
  const test5 = await testScenario(
    "5: User accepts offer - should trigger",
    [
      { role: "user", content: "I have an apartment viewing tomorrow" },
      { role: "assistant", content: "nice, want me to put together some questions for the viewing?" },
      { role: "user", content: "yeah that'd be great" }
    ],
    "Should say trigger phrase"
  );

  // Test 6: User declines offer
  const test6 = await testScenario(
    "6: User declines offer - should move on",
    [
      { role: "assistant", content: "want me to put something together for that?" },
      { role: "user", content: "nah I'm good, I just wanted to talk through it" }
    ],
    "Should accept gracefully, NOT push again"
  );

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Test 1 (explicit ask): ${test1.hasTrigger ? "✅ PASS" : "❌ FAIL - no trigger"}`);
  console.log(`Test 2 (should offer): ${test2.offersToCreate ? "✅ PASS" : "⚠️  Didn't offer (might be OK)"}`);
  console.log(`Test 3 (just chatting): ${!test3.offersToCreate ? "✅ PASS" : "❌ FAIL - shouldn't offer"}`);
  console.log(`Test 4 (venting): ${!test4.offersToCreate ? "✅ PASS" : "⚠️  Offered too early"}`);
  console.log(`Test 5 (accepts offer): ${test5.hasTrigger ? "✅ PASS" : "❌ FAIL - no trigger"}`);
  console.log(`Test 6 (declines): ${!test6.offersToCreate ? "✅ PASS" : "❌ FAIL - pushed again"}`);
}

runTests().catch(console.error);
