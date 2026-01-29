/**
 * Voice/Personality Tests
 * Tests that each agent maintains their unique voice
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000'

interface VoiceTest {
  creatorId: string
  creatorName: string
  messages: string[]
  voiceMarkers: {
    good: string[]  // Phrases that indicate correct voice
    bad: string[]   // Phrases that indicate wrong voice (too generic)
  }
}

const VOICE_TESTS: VoiceTest[] = [
  {
    creatorId: 'mike',
    creatorName: 'Mike',
    messages: [
      'yo',
      'how do I lose weight',
      'I dont have time to work out',
      'what supplements should I take'
    ],
    voiceMarkers: {
      good: ['bro', 'man', 'dude', 'whats up', 'protein', 'sleep', 'consistency'],
      bad: ['I\'d be happy to', 'Great question', 'optimize', 'leverage', 'That\'s wonderful']
    }
  },
  {
    creatorId: 'sarah',
    creatorName: 'Sarah',
    messages: [
      'hey',
      'I\'m so stressed',
      'I cant sleep',
      'how do I meditate'
    ],
    voiceMarkers: {
      good: ['pause', 'breath', 'ground', 'notice', 'one thing', '5 minutes'],
      bad: ['I hear you', 'Namaste', 'universe', 'That sounds hard', 'I understand how']
    }
  },
  {
    creatorId: 'kagan',
    creatorName: 'Kagan',
    messages: [
      'yo',
      'I want to start a startup',
      'how do I raise money',
      'whats a good mvp'
    ],
    voiceMarkers: {
      good: ['ya', 'tbh', 'ngl', 'ship', 'build', 'users'],
      bad: ['I\'d be happy to', 'Great question', 'Let me help you', 'That\'s a wonderful']
    }
  }
]

async function testVoice(test: VoiceTest) {
  console.log(`\nTesting ${test.creatorName}'s voice\n`)

  let goodCount = 0
  let badCount = 0
  let totalResponses = 0

  for (const message of test.messages) {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        userId: `voice-test-${Date.now()}`,
        creatorId: test.creatorId
      })
    })

    const data = await res.json()
    const response = (data.response || '').toLowerCase()
    totalResponses++

    console.log(`User: "${message}"`)
    console.log(`${test.creatorName}: "${data.response?.slice(0, 100)}..."`)

    // Check for good markers
    const foundGood = test.voiceMarkers.good.filter(m => response.includes(m.toLowerCase()))
    if (foundGood.length > 0) {
      console.log(`   Good markers: ${foundGood.join(', ')}`)
      goodCount++
    }

    // Check for bad markers
    const foundBad = test.voiceMarkers.bad.filter(m => response.includes(m.toLowerCase()))
    if (foundBad.length > 0) {
      console.log(`   Bad markers: ${foundBad.join(', ')}`)
      badCount++
    }

    console.log('')
    await new Promise(r => setTimeout(r, 500))
  }

  const score = Math.round(((totalResponses - badCount) / totalResponses) * 100)
  console.log(`${test.creatorName} Voice Score: ${score}% (${badCount} violations)`)

  return { score, badCount }
}

async function runVoiceTests() {
  console.log('Running Voice/Personality Tests')
  console.log('-'.repeat(60))

  const results: { name: string; score: number }[] = []

  for (const test of VOICE_TESTS) {
    const result = await testVoice(test)
    results.push({ name: test.creatorName, score: result.score })
  }

  console.log('\n' + '-'.repeat(60))
  console.log('\nFinal Voice Scores:\n')

  for (const r of results) {
    const bar = '#'.repeat(Math.round(r.score / 10)) + '-'.repeat(10 - Math.round(r.score / 10))
    console.log(`${r.name.padEnd(10)} ${bar} ${r.score}%`)
  }

  const avgScore = Math.round(results.reduce((a, b) => a + b.score, 0) / results.length)
  console.log(`\nAverage: ${avgScore}%`)

  process.exit(avgScore < 70 ? 1 : 0)
}

runVoiceTests()
