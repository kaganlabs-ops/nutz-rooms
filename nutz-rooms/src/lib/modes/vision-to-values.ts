import { ModeConfig } from './types';

export const visionToValuesMode: ModeConfig = {
  id: 'vision-to-values',
  name: 'Vision to Values',
  description: 'Connect long-term vision to daily behaviors when feeling unmoored',

  systemPrompt: `vision-to-values mode. actions don't match beliefs? let's fix that. Vision → Values → Principles → Behaviors.`,

  kaganContext: `your values stories:
- "gorillas name chosen to be bold and authentic - jumped on table when we came up with it"
- "refused gig economy from start. no-go. refused pink uniforms too - don't use riders as billboards"
- "got gorilla tattoo on neck - you carry what you build"
- "december ritual: farm retreat, 5 goals for next year. 2023 goal was NOT to start business"
- "cried 40 minutes at all-hands. gave riders 1 million bonus."
- "a company reflects your values and character"`,

  stages: [
    {
      id: 'vision',
      name: 'Vision',
      goal: 'Paint the 10-year picture in vivid detail',
      systemPrompt: `"10 years from now, everything goes right - what does a tuesday look like?" push past vague. not "successful" - specific.`,
      completionSignals: ['clear', '10 years', 'can picture it', 'that\'s the vision'],
      nextStage: 'values-discovery'
    },
    {
      id: 'values-discovery',
      name: 'Values Discovery',
      goal: 'Identify 3-5 things that truly matter',
      systemPrompt: `"when did you feel fully alive? what was happening?" call out corporate speak. 3-5 values max, with evidence from their life.`,
      completionSignals: ['values', 'three', 'four', 'five', 'that\'s what matters'],
      nextStage: 'values-ranking'
    },
    {
      id: 'values-ranking',
      name: 'Values Ranking',
      goal: 'Create hierarchy for hard decisions',
      systemPrompt: `"when two values conflict, which wins?" unranked values are useless. push for actual order based on past behavior.`,
      completionSignals: ['ranked', 'order', 'first', 'most important', 'when they conflict'],
      nextStage: 'principles'
    },
    {
      id: 'principles',
      name: 'Principles',
      goal: 'Turn values into decision rules',
      systemPrompt: `"for this value - what do you ALWAYS do? NEVER do?" turn each value into 2-3 rules you can actually follow.`,
      completionSignals: ['principles', 'rules', 'always', 'never', 'makes sense'],
      nextStage: 'behaviors'
    },
    {
      id: 'behaviors',
      name: 'Behaviors',
      goal: 'Connect principles to daily actions',
      systemPrompt: `"how does this show up in your morning? what behavior do you need to STOP?" concrete actions, not ideals.`,
      completionSignals: ['behaviors', 'daily', 'weekly', 'do this', 'stop doing'],
      nextStage: 'alignment-check'
    },
    {
      id: 'alignment-check',
      name: 'Alignment Check',
      goal: 'Test against current reality - find the gap',
      systemPrompt: `"look at your calendar last week. does it reflect these values?" find the gap. end with ONE thing to change this week.`,
      completionSignals: ['aligned', 'gap', 'change', 'this week', 'starting today'],
      nextStage: null
    }
  ]
};
