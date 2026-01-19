import type { ModeConfig } from './types';

export const shipCycleMode: ModeConfig = {
  id: 'ship-cycle',
  name: 'Ship Cycle',
  description: 'Go from idea to traction to funding',
  systemPrompt: `You're helping someone ship something. Guide them through the stages.
Current stage: {stage}
Stage goal: {stageGoal}

Be direct. Push for action. No hand-holding.`,

  stages: [
    {
      id: 'idea-verification',
      name: 'Idea Verification',
      goal: 'Validate the problem is real and worth solving',
      systemPrompt: `Help them verify the idea. Ask:
- What problem are you solving?
- Who has this problem? Can you name 3 people?
- How do they solve it today?
- Why is now the right time?

Push back on weak answers. Don't let them skip validation.`,
      completionSignals: ['problem is clear', 'validated', 'people i can talk to', 'real problem', 'talked to', 'confirmed'],
      nextStage: 'first-prototype'
    },
    {
      id: 'first-prototype',
      name: 'First Prototype',
      goal: 'Build the ugliest thing that works',
      systemPrompt: `Help them scope an MVP. Ask:
- What's the ONE thing it needs to do?
- What's the simplest version?
- Can you build it in a weekend?

Push them to cut scope ruthlessly. The goal is learning, not perfection.`,
      completionSignals: ['built it', 'shipped', 'prototype ready', 'it works', 'done building', 'have something'],
      nextStage: 'x-post'
    },
    {
      id: 'x-post',
      name: 'X Post',
      goal: 'Ship publicly and get feedback',
      systemPrompt: `Help them announce. Ask:
- What's the hook?
- Who needs to see this?
- What do you want people to do?

Help them craft a post that gets engagement. Push them to actually post.`,
      completionSignals: ['posted', 'shared', 'announced', 'live', 'tweeted', 'put it out'],
      nextStage: 'feedback'
    },
    {
      id: 'feedback',
      name: 'Feedback Loop',
      goal: 'Talk to users and iterate',
      systemPrompt: `Help them gather and act on feedback. Ask:
- What are people saying?
- What surprised you?
- What's the #1 complaint or request?

Push them to talk to actual users, not just look at analytics.`,
      completionSignals: ['talked to users', 'feedback collected', 'learned', 'iterated', 'changed based on', 'users said'],
      nextStage: 'traction'
    },
    {
      id: 'traction',
      name: 'Traction',
      goal: 'Get repeatable usage or revenue',
      systemPrompt: `Help them find traction. Ask:
- Are people coming back?
- Are people paying?
- What's your growth loop?
- Who are your best users and why?

Push for specific numbers, not vibes.`,
      completionSignals: ['paying customers', 'retention', 'growing', 'revenue', 'users coming back', 'recurring'],
      nextStage: 'pitch'
    },
    {
      id: 'pitch',
      name: 'Pitch',
      goal: 'Craft a compelling story for investors',
      systemPrompt: `Help them build their pitch. Cover:
- Problem (make it feel urgent)
- Solution (demo > slides)
- Traction (numbers)
- Team (why you)
- Ask (what you need)

Push for clarity and specificity. Cut the fluff.`,
      completionSignals: ['pitch ready', 'deck done', 'can pitch', 'story clear', 'ready to present'],
      nextStage: 'vc-connect'
    },
    {
      id: 'vc-connect',
      name: 'VC Connect',
      goal: 'Get meetings and close',
      systemPrompt: `Help them fundraise. Ask:
- Who are you targeting?
- What's your warm intro strategy?
- What's your timeline?

Help with outreach, follow-ups, negotiation. This is a sales process.`,
      completionSignals: ['meeting scheduled', 'term sheet', 'funded', 'closed', 'got the meeting', 'investor interested'],
      nextStage: null
    }
  ]
};
