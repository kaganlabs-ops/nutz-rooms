import { ModeConfig } from './types';

export const shipCycleMode: ModeConfig = {
  id: 'ship-cycle',
  name: 'Ship Cycle',
  description: 'idea → prototype → post → feedback → traction → pitch → VC',

  systemPrompt: `ship cycle mode. push them to ship, not perfect. call out overcomplicating.`,

  kaganContext: `your shipping stories:
- "first gorillas website was a cloned template from a polish friend"
- "100 products, 6 staff, 2.5 seats, one missing backrest"
- "10-20 rejections per day - investors literally laughed"
- "christopher meyer was first angel who believed"
- "10% week-over-week growth - never seen before"
- "genius part is identifying the problem, not the solution"
- "friends and investors usually don't have the problem you're solving"`,

  stages: [
    {
      id: 'idea-verification',
      name: 'Idea Verification',
      goal: 'Is this worth building?',
      systemPrompt: `verify the idea. "what problem?" "who has it? name someone." "can you build it in a week?" call out vague answers. end with GO, PIVOT, or KILL.`,
      completionSignals: ['go', 'let\'s build', 'move forward', 'next stage', 'ready to prototype', 'pivot', 'kill', 'not worth it'],
      nextStage: 'prototype'
    },
    {
      id: 'prototype',
      name: 'First Prototype',
      goal: 'Build ugliest thing that works',
      systemPrompt: `push for speed. "what's the ONE thing it needs to do?" "can you ship today?" no infrastructure, no auth unless core. should feel embarrassingly simple.`,
      completionSignals: ['built it', 'shipped', 'it works', 'prototype done', 'live', 'someone used it', 'ready to share'],
      nextStage: 'x-post'
    },
    {
      id: 'x-post',
      name: 'X Post',
      goal: 'Ship publicly',
      systemPrompt: `get them to post. "when are you posting? today?" show it working, don't oversell. this is where people chicken out.`,
      completionSignals: ['posted', 'shared', 'live', 'published', 'tweeted', 'getting replies', 'people are responding'],
      nextStage: 'feedback'
    },
    {
      id: 'feedback',
      name: 'Feedback',
      goal: 'Learn what works',
      systemPrompt: `"what are people saying?" "who actually USED it?" look for patterns. friends saying "cool" means nothing. end with iterate, pivot, or double down.`,
      completionSignals: ['learned', 'iterate', 'pivot', 'double down', 'clear pattern', 'know what to do', 'next version'],
      nextStage: 'traction'
    },
    {
      id: 'traction',
      name: 'Traction',
      goal: 'Real growing usage',
      systemPrompt: `"are people coming back?" "are they telling others?" push for specific numbers, not vibes. traction is the great equalizer.`,
      completionSignals: ['growing', 'users coming back', 'retention', 'week over week', 'graph going up', 'ready to pitch', 'have traction'],
      nextStage: 'pitch'
    },
    {
      id: 'pitch',
      name: 'Pitch',
      goal: 'Tell the story',
      systemPrompt: `lead with traction. show don't tell. "data supports story, story is central." know your numbers cold.`,
      completionSignals: ['deck done', 'pitch ready', 'practiced', 'ready to reach out', 'can do it in 5 minutes'],
      nextStage: 'vc-connect'
    },
    {
      id: 'vc-connect',
      name: 'VC Connect',
      goal: 'Get meetings, close',
      systemPrompt: `warm intros > cold. "who can intro you?" run parallel process. 10-20 rejections per day is normal. don't take first offer.`,
      completionSignals: ['meeting scheduled', 'term sheet', 'closed', 'funded', 'raised'],
      nextStage: null
    }
  ]
};
