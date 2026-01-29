/**
 * Test scenarios for Phase 2 architecture
 * Tests: get_knowledge tool, refer_to_agent tool, lean prompt
 *
 * Run: npx tsx scripts/test-scenarios.ts
 */

import Anthropic from '@anthropic-ai/sdk';
import { getKaganPrompt } from '../src/lib/agent/prompts/kagan-personality';
import { registerAllTools, toolRegistry } from '../src/lib/tools';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Initialize tools
registerAllTools();

interface TestScenario {
  name: string;
  mode: 'chat' | 'voice';
  message: string;
  expectTool?: string;
  expectPattern?: RegExp;
}

const scenarios: TestScenario[] = [
  // Knowledge tool tests
  {
    name: 'Gorillas founding story',
    mode: 'chat',
    message: 'how did you start gorillas?',
    expectTool: 'get_knowledge',
  },
  {
    name: 'Ronnie story',
    mode: 'chat',
    message: 'tell me about how you found your CTO',
    expectTool: 'get_knowledge',
  },
  {
    name: 'MVP advice (should use beliefs)',
    mode: 'chat',
    message: 'I keep polishing my app, cant ship',
    expectTool: 'get_knowledge',
  },

  // Referral tool tests
  {
    name: 'Workout request → Mike',
    mode: 'chat',
    message: 'I need help with my workout routine',
    expectTool: 'refer_to_agent',
  },
  {
    name: 'Stress/meditation → Sarah',
    mode: 'chat',
    message: 'Im super stressed and cant sleep',
    expectTool: 'refer_to_agent',
  },

  // Voice mode tests
  {
    name: 'Voice: casual greeting',
    mode: 'voice',
    message: 'yo',
    expectPattern: /^.{1,30}$/, // Short response
  },
  {
    name: 'Voice: gorillas story',
    mode: 'voice',
    message: 'tell me about starting gorillas',
    expectTool: 'get_knowledge',
  },
];

async function runScenario(scenario: TestScenario): Promise<{ passed: boolean; details: string }> {
  const systemPrompt = getKaganPrompt(scenario.mode);

  // Get tool definitions
  const tools = toolRegistry.getByNames([
    'get_knowledge',
    'refer_to_agent',
    'web_search',
    'deploy_page',
  ], 'test-user');
  const toolDefinitions = toolRegistry.getToolDefinitions(tools);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: scenario.message }],
      tools: toolDefinitions as Anthropic.Tool[],
    });

    // Check for tool use
    const toolUseBlock = response.content.find(b => b.type === 'tool_use');
    const textBlock = response.content.find(b => b.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '';

    // Validate expectations
    if (scenario.expectTool) {
      if (toolUseBlock?.type === 'tool_use' && toolUseBlock.name === scenario.expectTool) {
        return {
          passed: true,
          details: `✅ Called ${scenario.expectTool} with input: ${JSON.stringify(toolUseBlock.input)}`
        };
      } else if (toolUseBlock?.type === 'tool_use') {
        return {
          passed: false,
          details: `❌ Expected ${scenario.expectTool}, got ${toolUseBlock.name}`
        };
      } else {
        return {
          passed: false,
          details: `❌ Expected ${scenario.expectTool} tool call, got text: "${text.substring(0, 100)}..."`
        };
      }
    }

    if (scenario.expectPattern) {
      if (scenario.expectPattern.test(text)) {
        return { passed: true, details: `✅ Response: "${text}"` };
      } else {
        return {
          passed: false,
          details: `❌ Pattern ${scenario.expectPattern} not matched. Got: "${text}"`
        };
      }
    }

    return { passed: true, details: `Response: "${text.substring(0, 100)}..."` };

  } catch (error) {
    return {
      passed: false,
      details: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

async function main() {
  console.log('\n🧪 Testing Phase 2 Architecture\n');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const scenario of scenarios) {
    console.log(`\n[${scenario.mode.toUpperCase()}] ${scenario.name}`);
    console.log(`   Message: "${scenario.message}"`);

    const result = await runScenario(scenario);
    console.log(`   ${result.details}`);

    if (result.passed) passed++;
    else failed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Results: ${passed}/${scenarios.length} passed`);

  if (failed > 0) {
    console.log(`\n⚠️  ${failed} scenarios failed`);
    process.exit(1);
  } else {
    console.log('\n✅ All scenarios passed!');
  }
}

main().catch(console.error);
