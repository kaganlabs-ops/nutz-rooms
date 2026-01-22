// Test if Kagan references his experience naturally
// Run with: cd /Users/kagan/nutz-rooms && export $(grep -v '^#' .env.local | xargs) && npx tsx scripts/test-kagan-experience.ts

import OpenAI from "openai";
import { KAGAN_VOICE_PROMPT } from "../src/lib/openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TestResult {
  reply: string;
  referencesExperience: boolean;
  experienceKeywords: string[];
}

// Keywords that indicate Kagan is referencing his experience
const EXPERIENCE_KEYWORDS = [
  "gorillas", "grocery", "delivery", "warehouse", "living room",
  "flyers", "mailbox", "5 euro", "five euro", "visa", "n26", "bank account",
  "minus", "-5k", "-8k", "wife", "ronnie", "cto", "lebanon",
  "bain", "rocket internet", "istanbul", "water polo", "china",
  "billion", "unicorn", "15k employees", "15 thousand employees", "15,000 employees", "230 stores",
  "10 percent", "10%", "conversion",
  "getir", "acquired", "burned",
  "sugar", "gatna", "pilates", "munich",
  "first iphone", "steve jobs", "app store",
  "polish friend", "cloned website",
  "24 months", "8 countries", "60 cities", "week over week",
];

async function testScenario(
  name: string,
  messages: Array<{role: "user" | "assistant", content: string}>,
  shouldReference: boolean
): Promise<TestResult> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`TEST: ${name}`);
  console.log(`${"=".repeat(60)}`);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 200,
    messages: [
      { role: "system", content: KAGAN_VOICE_PROMPT },
      ...messages
    ],
  });

  const reply = response.choices[0]?.message?.content || "";
  console.log(`\nKagan's response: "${reply}"`);

  // Check for experience references
  const lower = reply.toLowerCase();
  const foundKeywords = EXPERIENCE_KEYWORDS.filter(kw => lower.includes(kw.toLowerCase()));
  const referencesExperience = foundKeywords.length > 0;

  console.log(`\n📊 Analysis:`);
  console.log(`   Should reference experience: ${shouldReference ? "YES" : "NO"}`);
  console.log(`   Actually references experience: ${referencesExperience ? "✅ YES" : "❌ NO"}`);
  if (foundKeywords.length > 0) {
    console.log(`   Keywords found: ${foundKeywords.join(", ")}`);
  }

  const passed = shouldReference ? referencesExperience : true; // Only fail if should reference but didn't
  console.log(`   Result: ${passed ? "✅ PASS" : "❌ FAIL"}`);

  return { reply, referencesExperience, experienceKeywords: foundKeywords };
}

async function runTests() {
  console.log("Testing if Kagan references his experience naturally\n");

  // Test 1: User talks about early stage startup - should trigger Gorillas story
  const test1 = await testScenario(
    "1: User has early stage startup with few users",
    [
      { role: "user", content: "I launched my app 2 months ago and only have like 30 users" },
    ],
    true // Should reference experience
  );

  // Test 2: User is overwhelmed with money problems - should trigger N26 story
  const test2 = await testScenario(
    "2: User is stressed about money while building",
    [
      { role: "user", content: "I'm kinda stressed about money right now, my bank account is almost empty but I'm trying to build this thing" },
    ],
    true
  );

  // Test 3: User perfecting their product - should trigger first iPhone / MVP story
  const test3 = await testScenario(
    "3: User is trying to make product perfect",
    [
      { role: "user", content: "I've been working on this for 8 months and I keep finding things to fix before I can launch" },
    ],
    true
  );

  // Test 4: User asking about finding cofounders - should trigger Ronnie story
  const test4 = await testScenario(
    "4: User asking about finding technical cofounder",
    [
      { role: "user", content: "How did you find your CTO? I'm having trouble finding a technical cofounder" },
    ],
    true
  );

  // Test 5: User talking about validation - should trigger flyers/mailbox story
  const test5 = await testScenario(
    "5: User asking about validating demand",
    [
      { role: "user", content: "How do I know if people actually want this? I'm not sure how to validate the idea" },
    ],
    true
  );

  // Test 6: Just chatting - doesn't need to reference experience
  const test6 = await testScenario(
    "6: Just casual chat - no need to reference experience",
    [
      { role: "user", content: "yo what's up" },
    ],
    false
  );

  // Test 7: Multi-turn where Kagan should naturally share
  const test7 = await testScenario(
    "7: Multi-turn about rapid growth",
    [
      { role: "user", content: "We're growing like 15% week over week, it's kinda crazy" },
      { role: "assistant", content: "that's solid. how are you keeping up with it" },
      { role: "user", content: "barely, honestly. hiring is hard" },
    ],
    true // Should reference Gorillas growth/hiring experience
  );

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Test 1 (early stage): ${test1.referencesExperience ? "✅ PASS" : "❌ FAIL - should reference Gorillas"}`);
  console.log(`Test 2 (money stress): ${test2.referencesExperience ? "✅ PASS" : "❌ FAIL - should reference N26 story"}`);
  console.log(`Test 3 (perfectionism): ${test3.referencesExperience ? "✅ PASS" : "❌ FAIL - should reference MVP stories"}`);
  console.log(`Test 4 (finding CTO): ${test4.referencesExperience ? "✅ PASS" : "❌ FAIL - should reference Ronnie"}`);
  console.log(`Test 5 (validation): ${test5.referencesExperience ? "✅ PASS" : "❌ FAIL - should reference flyers"}`);
  console.log(`Test 6 (casual chat): ✅ PASS (no reference needed)`);
  console.log(`Test 7 (rapid growth): ${test7.referencesExperience ? "✅ PASS" : "❌ FAIL - should reference growth"}`);

  const passCount = [
    test1.referencesExperience,
    test2.referencesExperience,
    test3.referencesExperience,
    test4.referencesExperience,
    test5.referencesExperience,
    true, // test 6 always passes
    test7.referencesExperience,
  ].filter(Boolean).length;

  console.log(`\nTotal: ${passCount}/7 tests passed`);

  if (passCount < 5) {
    console.log("\n⚠️  Kagan isn't referencing his experience enough!");
    console.log("The prompt may need stronger instructions to share stories proactively.");
  }
}

runTests().catch(console.error);
