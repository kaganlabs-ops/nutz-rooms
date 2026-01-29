/**
 * Comprehensive test script for the lean Kagan prompt
 *
 * Run with: npx tsx scripts/test-lean-prompt.ts
 */

import fs from 'fs';
import path from 'path';

// Load .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}
import Anthropic from '@anthropic-ai/sdk';
import { getKaganPrompt, KAGAN_PERSONALITY } from '../src/lib/agent/prompts/kagan-personality';

// Load from .env.local if not in environment
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('❌ ANTHROPIC_API_KEY not found. Set it in .env.local or environment.');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey });

// ============================================
// PART 1: UNIT TESTS (no API calls)
// ============================================

function runUnitTests() {
  console.log('\n========== UNIT TESTS ==========\n');

  // Test 1: Prompt length
  const chatPrompt = getKaganPrompt('chat');
  const wordCount = chatPrompt.split(/\s+/).length;
  const charCount = chatPrompt.length;
  console.log(`✓ Chat prompt: ${wordCount} words, ${charCount} chars`);
  console.log(`  Target: ~350 words, ~2500 chars`);
  console.log(`  ${wordCount < 500 ? '✅ PASS' : '❌ FAIL - too long'}`);

  // Test 2: Voice mode adds note
  const voicePrompt = getKaganPrompt('voice');
  const hasVoiceMode = voicePrompt.includes('VOICE MODE');
  console.log(`\n✓ Voice prompt includes mode note: ${hasVoiceMode ? '✅ PASS' : '❌ FAIL'}`);

  // Test 3: Key personality elements present
  const personalityChecks = [
    { name: 'WHO YOU ARE section', check: KAGAN_PERSONALITY.includes('## WHO YOU ARE') },
    { name: 'gorillas mention', check: KAGAN_PERSONALITY.toLowerCase().includes('gorillas') },
    { name: 'sassy af energy', check: KAGAN_PERSONALITY.includes('sassy') },
    { name: 'no emojis rule', check: KAGAN_PERSONALITY.includes('NEVER use emojis') },
    { name: 'lowercase rule', check: KAGAN_PERSONALITY.includes('lowercase always') },
    { name: 'max words rule', check: KAGAN_PERSONALITY.includes('MAX 10-15 words') },
    { name: 'mike reference', check: KAGAN_PERSONALITY.toLowerCase().includes('mike') },
    { name: 'sarah reference', check: KAGAN_PERSONALITY.toLowerCase().includes('sarah') },
    { name: 'memory honesty', check: KAGAN_PERSONALITY.includes('MEMORY') },
    { name: 'banter examples', check: KAGAN_PERSONALITY.includes('BANTER EXAMPLES') },
  ];

  console.log('\n✓ Personality elements:');
  let allPass = true;
  for (const { name, check } of personalityChecks) {
    console.log(`  ${check ? '✅' : '❌'} ${name}`);
    if (!check) allPass = false;
  }
  console.log(`\n  Overall: ${allPass ? '✅ ALL PASS' : '❌ SOME FAILED'}`);

  // Test 4: Key banned behaviors mentioned (should be in prompt as "don't do this")
  const bannedBehaviors = [
    { phrase: "no \"I'd be happy to help\"", desc: 'bans assistant speak' },
    { phrase: "no \"absolutely\"", desc: 'bans filler validation' },
    { phrase: "no therapy speak", desc: 'bans therapy language' },
  ];

  console.log('\n✓ Banned behaviors documented:');
  for (const { phrase, desc } of bannedBehaviors) {
    const found = KAGAN_PERSONALITY.toLowerCase().includes(phrase.toLowerCase());
    console.log(`  ${found ? '✅' : '❌'} ${desc}`);
  }

  return allPass;
}

// ============================================
// PART 2: CLAUDE API TESTS (actual responses)
// ============================================

interface TestCase {
  name: string;
  input: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  expect: {
    maxWords?: number;
    mustInclude?: string[];
    mustNotInclude?: string[];
    emojiCheck?: boolean; // if true, fail if emojis found
  };
}

const testCases: TestCase[] = [
  {
    name: "1. Greeting - friend energy",
    input: "yo",
    expect: {
      maxWords: 10,
      mustNotInclude: ["How can I help", "What can I do", "Is there anything", "happy to"],
      emojiCheck: true,
    }
  },
  {
    name: "2. Greeting - chill response",
    input: "not much just vibing",
    history: [
      { role: 'user', content: 'yo' },
      { role: 'assistant', content: 'yo whats up' },
    ],
    expect: {
      maxWords: 10,
      mustNotInclude: ["What are you working on", "anything specific", "how can I"],
      emojiCheck: true,
    }
  },
  {
    name: "3. Workout request - should mention Mike",
    input: "I need help with my workout routine",
    expect: {
      maxWords: 50,
      mustNotInclude: ["I'd be happy to", "Absolutely", "Great question", "##", "refer_to_agent"],
      emojiCheck: true,
    }
  },
  {
    name: "4. Gorillas question - should know the story",
    input: "how did you start gorillas",
    expect: {
      maxWords: 80,
      mustNotInclude: ["I don't know", "what do you mean", "which gorillas", "##"],
      emojiCheck: true,
    }
  },
  {
    name: "5. Overwhelmed founder",
    input: "honestly feeling super overwhelmed right now",
    expect: {
      maxWords: 20,
      mustNotInclude: ["that must be tough", "I understand", "I hear you", "that sounds"],
      emojiCheck: true,
    }
  },
  {
    name: "6. Multiple ideas - should push back",
    input: "I have 5 different startup ideas I'm working on",
    expect: {
      maxWords: 25,
      mustNotInclude: ["that's great", "exciting", "I'd love to hear"],
      emojiCheck: true,
    }
  },
  {
    name: "7. Perfectionist - should challenge",
    input: "I've been working on this for 6 months trying to make it perfect before launch",
    expect: {
      maxWords: 50,
      mustNotInclude: ["that's understandable", "take your time", "it's important to"],
      emojiCheck: true,
    }
  },
  {
    name: "8. No assistant energy",
    input: "can you help me with my startup",
    expect: {
      mustNotInclude: ["I'd be happy to", "Of course!", "Absolutely", "definitely", "I'd love to"],
      emojiCheck: true,
    }
  },
  {
    name: "9. Troll response",
    input: "this is stupid",
    expect: {
      maxWords: 20,
      mustNotInclude: ["I'm sorry you feel", "I understand your frustration"],
      emojiCheck: true,
    }
  },
  {
    name: "10. Memory honesty",
    input: "remember what you told me last week about my startup?",
    expect: {
      mustInclude: ["dont remember", "don't remember", "not seeing", "dont have that", "don't have"],
      mustNotInclude: ["Yes, I remember", "Of course, we talked about"],
      emojiCheck: true,
    }
  },
];

function hasEmoji(text: string): boolean {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/u;
  return emojiRegex.test(text);
}

async function runApiTests() {
  console.log('\n========== CLAUDE API TESTS ==========\n');

  const results: { name: string; passed: boolean; response: string; issues: string[] }[] = [];

  for (const test of testCases) {
    const messages: Anthropic.MessageParam[] = [];

    // Add history if provided
    if (test.history) {
      for (const msg of test.history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add current input
    messages.push({ role: 'user', content: test.input });

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        system: getKaganPrompt('chat'),
        messages,
      });

      const text = response.content[0].type === 'text'
        ? response.content[0].text
        : '';
      const wordCount = text.split(/\s+/).length;

      let passed = true;
      const issues: string[] = [];

      // Check max words
      if (test.expect.maxWords && wordCount > test.expect.maxWords) {
        passed = false;
        issues.push(`Too long: ${wordCount} words (max ${test.expect.maxWords})`);
      }

      // Check must include (any match counts)
      if (test.expect.mustInclude && test.expect.mustInclude.length > 0) {
        const foundAny = test.expect.mustInclude.some(phrase =>
          text.toLowerCase().includes(phrase.toLowerCase())
        );
        if (!foundAny) {
          passed = false;
          issues.push(`Missing one of: ${test.expect.mustInclude.join(' | ')}`);
        }
      }

      // Check must not include
      if (test.expect.mustNotInclude) {
        for (const phrase of test.expect.mustNotInclude) {
          if (text.toLowerCase().includes(phrase.toLowerCase())) {
            passed = false;
            issues.push(`Found forbidden: "${phrase}"`);
          }
        }
      }

      // Check for emojis
      if (test.expect.emojiCheck && hasEmoji(text)) {
        passed = false;
        issues.push('Contains emoji (forbidden)');
      }

      results.push({ name: test.name, passed, response: text, issues });

      const status = passed ? '✅' : '❌';
      console.log(`${status} ${test.name}`);
      console.log(`   Input: "${test.input}"`);
      console.log(`   Output: "${text}"`);
      console.log(`   Words: ${wordCount}`);
      if (issues.length > 0) {
        console.log(`   Issues: ${issues.join(', ')}`);
      }
      console.log('');

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(`❌ ${test.name}`);
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('');
      results.push({ name: test.name, passed: false, response: '', issues: ['API error'] });
    }
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  console.log('\n========== SUMMARY ==========\n');
  console.log(`Passed: ${passed}/${total}`);
  console.log(`Failed: ${total - passed}/${total}`);

  if (passed === total) {
    console.log('\n🎉 ALL TESTS PASSED!\n');
  } else {
    console.log('\n⚠️  Some tests failed. Review above.\n');
    console.log('Failed tests:');
    for (const result of results) {
      if (!result.passed) {
        console.log(`  - ${result.name}: ${result.issues.join(', ')}`);
      }
    }
  }

  return passed === total;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('\n🧪 LEAN PROMPT TEST SUITE\n');
  console.log('Testing: kagan-personality.ts');
  console.log('=' .repeat(50));

  // Run unit tests
  const unitTestsPassed = runUnitTests();

  // Run API tests
  const apiTestsPassed = await runApiTests();

  // Final verdict
  console.log('========== FINAL VERDICT ==========\n');
  if (unitTestsPassed && apiTestsPassed) {
    console.log('✅ READY TO SHIP\n');
    process.exit(0);
  } else {
    console.log('❌ NOT READY - fix issues above\n');
    process.exit(1);
  }
}

main().catch(console.error);
