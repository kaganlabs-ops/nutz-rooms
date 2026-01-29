/**
 * Multi-Agent Test Suite
 * Run: npx ts-node tests/agents/test-agents.ts
 * Or: pnpm test:agents
 */

export {}; // Make this a module to avoid global scope conflicts

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000'

interface TestCase {
  name: string
  creatorId: string
  message: string
  expect: {
    shouldInclude?: string[]
    shouldNotInclude?: string[]
    maxLength?: number
    minLength?: number
    referralTo?: string  // Expected referral target creator ID
  }
}

const TEST_CASES: TestCase[] = [
  // Mike Tests
  {
    name: 'Mike: Basic greeting',
    creatorId: 'mike',
    message: 'yo',
    expect: {
      maxLength: 50,
      shouldNotInclude: ['How can I help you today', 'Great to meet you']
    }
  },
  {
    name: 'Mike: Workout question',
    creatorId: 'mike',
    message: 'I want to get stronger but I have no time',
    expect: {
      shouldNotInclude: ['I understand', 'That\'s a great goal', 'optimize', 'maximize'],
      maxLength: 400
    }
  },
  {
    name: 'Mike: Challenges excuses',
    creatorId: 'mike',
    message: 'I keep skipping the gym because I\'m tired',
    expect: {
      shouldNotInclude: ['I totally understand', 'That\'s completely normal'],
      maxLength: 400
    }
  },

  // Sarah Tests
  {
    name: 'Sarah: Basic greeting',
    creatorId: 'sarah',
    message: 'hey',
    expect: {
      maxLength: 100,  // Sarah asks a follow-up question
      shouldNotInclude: ['How can I help you today', 'Namaste']
    }
  },
  {
    name: 'Sarah: Stress response',
    creatorId: 'sarah',
    message: 'I\'m freaking out everything is falling apart',
    expect: {
      shouldNotInclude: ['I hear you', 'That sounds really hard', 'Everything will be okay'],
      maxLength: 500  // Sarah gives grounding instructions for panic
    }
  },
  {
    name: 'Sarah: Meditation question',
    creatorId: 'sarah',
    message: 'I want to start meditating but I can\'t clear my mind',
    expect: {
      shouldNotInclude: ['empty your mind', 'trust the universe', 'Namaste'],
      maxLength: 1200  // Sarah gives longer explanations for meditation
    }
  },

  // Kagan Tests
  {
    name: 'Kagan: Basic greeting',
    creatorId: 'kagan',
    message: 'yo',
    expect: {
      maxLength: 50,
      shouldNotInclude: ['How can I assist you', 'Hello! I\'m happy to help']
    }
  },
  {
    name: 'Kagan: Startup question',
    creatorId: 'kagan',
    message: 'I want to start a company but I don\'t know where to begin',
    expect: {
      shouldNotInclude: ['That\'s a great question', 'I\'d be happy to help'],
      maxLength: 300
    }
  },

  // Cross-domain tests - agents should handle gracefully (organic referrals happen over multi-turn convos)
  {
    name: 'Kagan: Handles fitness topic (responds, may mention Mike naturally)',
    creatorId: 'kagan',
    message: 'I need help with my workout routine',
    expect: {
      maxLength: 400,
      shouldNotInclude: ['I\'d be happy to help', 'That\'s a great question']
    }
  },
  {
    name: 'Mike: Handles stress topic (responds, may mention Sarah naturally)',
    creatorId: 'mike',
    message: 'I\'ve been feeling stressed lately',
    expect: {
      maxLength: 400,
      shouldNotInclude: ['I totally understand', 'That\'s completely normal']
    }
  },
  {
    name: 'Sarah: Handles fitness topic (responds, may mention Mike naturally)',
    creatorId: 'sarah',
    message: 'I want to start working out',
    expect: {
      maxLength: 800,
      shouldNotInclude: ['That sounds great', 'I hear you']
    }
  }
]

async function runTest(test: TestCase): Promise<{ passed: boolean; error?: string; response?: string; referral?: { creatorId: string } }> {
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: test.message,
        userId: `test-${Date.now()}`,
        creatorId: test.creatorId
      })
    })

    if (!res.ok) {
      return { passed: false, error: `HTTP ${res.status}` }
    }

    const data = await res.json()
    const response = data.response || ''
    const referral = data.referral

    // Check referral (new referral system)
    if (test.expect.referralTo) {
      if (!referral || referral.creatorId !== test.expect.referralTo) {
        return {
          passed: false,
          error: `Expected referral to "${test.expect.referralTo}", got: ${referral ? referral.creatorId : 'none'}`,
          response,
          referral
        }
      }
      // Referral test passed
      return { passed: true, response, referral }
    }

    // Check max length
    if (test.expect.maxLength && response.length > test.expect.maxLength) {
      return {
        passed: false,
        error: `Response too long: ${response.length} > ${test.expect.maxLength}`,
        response
      }
    }

    // Check min length
    if (test.expect.minLength && response.length < test.expect.minLength) {
      return {
        passed: false,
        error: `Response too short: ${response.length} < ${test.expect.minLength}`,
        response
      }
    }

    // Check shouldInclude
    if (test.expect.shouldInclude) {
      for (const phrase of test.expect.shouldInclude) {
        if (!response.toLowerCase().includes(phrase.toLowerCase())) {
          return {
            passed: false,
            error: `Missing expected phrase: "${phrase}"`,
            response
          }
        }
      }
    }

    // Check shouldNotInclude
    if (test.expect.shouldNotInclude) {
      for (const phrase of test.expect.shouldNotInclude) {
        if (response.toLowerCase().includes(phrase.toLowerCase())) {
          return {
            passed: false,
            error: `Found forbidden phrase: "${phrase}"`,
            response
          }
        }
      }
    }

    return { passed: true, response }
  } catch (err) {
    return { passed: false, error: String(err) }
  }
}

async function runAllTests() {
  console.log('Running Multi-Agent Tests\n')
  console.log(`Base URL: ${BASE_URL}\n`)
  console.log('-'.repeat(60))

  let passed = 0
  let failed = 0

  for (const test of TEST_CASES) {
    process.stdout.write(`${test.name}... `)

    const result = await runTest(test)

    if (result.passed) {
      console.log('PASS')
      if (result.referral) {
        console.log(`   Referral: → ${result.referral.creatorId}`)
      }
      passed++
    } else {
      console.log('FAIL')
      console.log(`   Error: ${result.error}`)
      if (result.response) {
        console.log(`   Response: "${result.response.slice(0, 100)}..."`)
      }
      failed++
    }

    // Small delay between tests
    await new Promise(r => setTimeout(r, 500))
  }

  console.log('-'.repeat(60))
  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  console.log(`   Pass rate: ${Math.round((passed / (passed + failed)) * 100)}%\n`)

  process.exit(failed > 0 ? 1 : 0)
}

runAllTests()
