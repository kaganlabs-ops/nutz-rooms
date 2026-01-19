import type { ModeConfig } from './types';

export const onePagerMode: ModeConfig = {
  id: '1-pager',
  name: '1-Pager',
  description: 'Crystallize what you\'re doing into a clear one-page document',
  systemPrompt: `You're helping the user create a 1-pager - a one-page document that crystallizes what they're doing, why, for who, and how.

Your style: Direct, clarifying. Keep responses SHORT. Push for specificity over vagueness.

Current stage: {stage}
Stage goal: {stageGoal}`,

  stages: [
    {
      id: 'problem',
      name: 'The Problem',
      goal: 'Nail the pain you\'re solving',
      systemPrompt: `Help them articulate the problem. Ask:
- What problem are you solving?
- Who has this problem?
- How do they currently deal with it?
- What's broken about current solutions?

Don't move on until they can state the problem in one sentence that makes someone go "oh yeah, that sucks."`,
      completionSignals: ['problem is', 'the pain is', 'they struggle with', 'that\'s the problem'],
      nextStage: 'solution'
    },
    {
      id: 'solution',
      name: 'The Solution',
      goal: 'Crystallize what you\'re building',
      systemPrompt: `Help them explain the solution. Ask:
- What's your solution in one sentence?
- What's the core insight or approach?
- Why will this work when others haven't?
- What's the simplest version that solves the problem?

No jargon. No buzzwords.`,
      completionSignals: ['solution is', 'we solve this by', 'the approach is', 'it works by'],
      nextStage: 'for-who'
    },
    {
      id: 'for-who',
      name: 'For Who',
      goal: 'Define the specific person this is for',
      systemPrompt: `Help them define their user. Ask:
- Who is your ideal first user? Be specific.
- Why are they perfect for this?
- Where do they hang out?
- What would make them tell a friend?

They should be able to describe someone specific enough to find them today.`,
      completionSignals: ['the user is', 'it\'s for', 'target is', 'ideal customer'],
      nextStage: 'why-you'
    },
    {
      id: 'why-you',
      name: 'Why You',
      goal: 'Establish credibility and unique angle',
      systemPrompt: `Help them articulate why they're the ones to build this. Ask:
- Why are you the one to build this?
- What do you know that others don't?
- What's your unfair advantage?
- What's the story of how you got here?

No "passionate about the space." Real differentiation.`,
      completionSignals: ['because i', 'my advantage is', 'i know this because', 'my background'],
      nextStage: 'how-it-works'
    },
    {
      id: 'how-it-works',
      name: 'How It Works',
      goal: 'Make the solution tangible',
      systemPrompt: `Help them describe the experience. Ask:
- Walk me through the user experience
- What does day 1 look like for a user?
- What's the "aha moment"?
- How do they know it's working?

Make it concrete and visual.`,
      completionSignals: ['user does', 'the flow is', 'it works like', 'they experience'],
      nextStage: 'whats-next'
    },
    {
      id: 'whats-next',
      name: 'What\'s Next',
      goal: 'Define immediate action',
      systemPrompt: `Help them define next steps. Ask:
- What's the one thing you need to prove first?
- What does success look like in 30 days?
- What are you NOT doing right now?
- What do you need to make this happen?

Get a clear, concrete next step.`,
      completionSignals: ['next is', 'going to', 'first step', 'in 30 days'],
      nextStage: null
    }
  ]
};
