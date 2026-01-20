import { ModeConfig } from './types';

export const onePagerMode: ModeConfig = {
  id: '1-pager',
  name: '1-Pager Memo',
  description: 'Crystallize what you\'re doing, why, for who, and how',

  systemPrompt: `1-pager mode. if you can't fit it on one page, you don't understand it yet. call out jargon.`,

  kaganContext: `your 1-pager stories:
- "genius part is identifying the problem, not the solution"
- "first website was 'get goodies' - hated it. gorillas expressed WHO we are"
- "people said 'postman who stops at one postbox?' they didn't get it"
- "10-minute delivery unprecedented. people thought crazy."
- "'everyone is the customer' is a mistake"`,

  stages: [
    {
      id: 'problem',
      name: 'The Problem',
      goal: 'Nail the pain in 2-3 sentences',
      systemPrompt: `"what problem? in plain english." call out jargon. don't move on until it would make a stranger nod.`,
      completionSignals: ['that\'s the problem', 'clear', 'got it', 'makes sense', 'nailed it'],
      nextStage: 'solution'
    },
    {
      id: 'solution',
      name: 'The Solution',
      goal: 'One sentence, no jargon',
      systemPrompt: `"solution in one sentence." plain language. call out "AI-powered" without meaning.`,
      completionSignals: ['that\'s the solution', 'clear', 'simple', 'got it'],
      nextStage: 'for-who'
    },
    {
      id: 'for-who',
      name: 'For Who',
      goal: 'Specific person you can find',
      systemPrompt: `"who specifically? name someone." call out "everyone" or "millennials". should be able to find them today.`,
      completionSignals: ['that\'s who', 'specific', 'can find them', 'know exactly'],
      nextStage: 'why-us'
    },
    {
      id: 'why-us',
      name: 'Why Us',
      goal: 'Credibility and unique angle',
      systemPrompt: `"why YOU?" call out generic passion. should make someone think "of course they're building this."`,
      completionSignals: ['that\'s why', 'makes sense', 'credible', 'unique'],
      nextStage: 'how-it-works'
    },
    {
      id: 'how-it-works',
      name: 'How It Works',
      goal: '3-5 steps, not features',
      systemPrompt: `"walk me through it." 3-5 steps. user journey, not feature list.`,
      completionSignals: ['got it', 'clear flow', 'makes sense', 'simple'],
      nextStage: 'whats-next'
    },
    {
      id: 'whats-next',
      name: 'What\'s Next',
      goal: '30-day milestone',
      systemPrompt: `"what's the ONE thing to prove first?" "30-day milestone?" end with: does this make you want to build it?`,
      completionSignals: ['got it', 'clear', '30 days', 'next step', 'ready'],
      nextStage: null
    }
  ]
};
