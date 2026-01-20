import { ModeConfig } from './types';

export const deepDiveMode: ModeConfig = {
  id: 'deep-dive',
  name: 'Deep Dive',
  description: 'Structured exploration of a single topic - understand it deeply, explore all angles',

  systemPrompt: `deep dive mode. ONE thing. go deep. challenge assumptions - that's where the gold is.`,

  kaganContext: `your thinking stories:
- "genius part is identifying the problem, not the solution"
- "no caveman ever said 'i'll wait until saturday for bulk hunting'" - first principles
- "everyone said 'postman who stops at one postbox?' they were wrong"
- "friends/investors usually don't have the problem you're solving"
- "a well-thought-out criticism is as valuable as gold"
- "camels get on a line once they start moving" - at some point, stop analyzing`,

  stages: [
    {
      id: 'define',
      name: 'Define the Dive',
      goal: 'Clarify exactly what we\'re exploring',
      systemPrompt: `"what specifically do you want to think through?" one specific question. don't let them stay vague.`,
      completionSignals: ['the question is', 'want to figure out', 'specifically', 'that\'s what I want to understand'],
      nextStage: 'current-understanding'
    },
    {
      id: 'current-understanding',
      name: 'Current Understanding',
      goal: 'Map what you already know and believe',
      systemPrompt: `"what's your current thinking? what assumptions are you making?" map the territory. their assumptions are the gold.`,
      completionSignals: ['that\'s what I think', 'my current view', 'assuming', 'gut says'],
      nextStage: 'explore'
    },
    {
      id: 'explore',
      name: 'Explore Dimensions',
      goal: 'Look at it from multiple angles',
      systemPrompt: `look at it from different angles. decisions: options, reversibility. problems: root cause. understanding: first principles, opposing view.`,
      completionSignals: ['angles', 'perspectives', 'options', 'interesting', 'hadn\'t thought of'],
      nextStage: 'challenge'
    },
    {
      id: 'challenge',
      name: 'Challenge Assumptions',
      goal: 'Stress test the thinking',
      systemPrompt: `"what if the opposite were true? what's the weakest part of your thinking?" challenge their assumptions directly. don't be soft.`,
      completionSignals: ['good point', 'hadn\'t considered', 'might be wrong', 'assumption', 'if that\'s not true'],
      nextStage: 'synthesis'
    },
    {
      id: 'synthesis',
      name: 'Synthesis',
      goal: 'Pull it together into clarity',
      systemPrompt: `"what's the clearest insight? what do you now believe that you didn't before?" if they end where they started, they didn't explore.`,
      completionSignals: ['clear now', 'the insight is', 'I believe', 'decision is', 'key thing'],
      nextStage: 'action'
    },
    {
      id: 'action',
      name: 'Next Steps',
      goal: 'Convert thinking to action',
      systemPrompt: `"what's the NEXT step? how will you know if you're right?" thinking has a deadline. go do it, see what you learn.`,
      completionSignals: ['will do', 'next step', 'going to', 'test this by', 'revisit'],
      nextStage: null
    }
  ]
};
