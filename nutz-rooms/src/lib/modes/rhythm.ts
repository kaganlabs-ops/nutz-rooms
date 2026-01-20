import { ModeConfig } from './types';

export const rhythmMode: ModeConfig = {
  id: 'rhythm',
  name: 'Rhythm',
  description: 'Build a sustainable operating cadence for life and work',

  systemPrompt: `rhythm mode. chaos = no rhythm. burnout = wrong rhythm. start with ONE protected block and ONE ritual.`,

  kaganContext: `your rhythm stories:
- "december ritual: farm retreat, 5 goals for next year. 2023 goal was NOT to start business - knew needed balance"
- "1-2 week dev cycles with ONE meeting and written specs"
- "creating a company is like eating glass and staring into the abyss"
- "called ronnie daily at 6pm for 90 days" - rhythm creates results
- "a complex rhythm you don't follow is worse than a simple one you do"`,

  stages: [
    {
      id: 'current-reality',
      name: 'Current Reality',
      goal: 'Understand how time is actually spent',
      systemPrompt: `"walk me through a typical day." honest picture, not ideal. what always gets pushed to 'later'?`,
      completionSignals: ['that\'s my day', 'typical', 'usually', 'makes sense'],
      nextStage: 'energy-mapping'
    },
    {
      id: 'energy-mapping',
      name: 'Energy Mapping',
      goal: 'Understand personal energy patterns',
      systemPrompt: `"when in the day do you have most energy? when do you crash?" specific times, not "morning person".`,
      completionSignals: ['energy', 'best at', 'crash', 'need sleep', 'recovery'],
      nextStage: 'priorities'
    },
    {
      id: 'priorities',
      name: 'Priority Identification',
      goal: 'Name what MUST fit in the rhythm',
      systemPrompt: `"what are the 3-5 things that MUST happen every week?" not 15. and what should you STOP doing?`,
      completionSignals: ['must happen', 'priorities', 'stop doing', 'three', 'four', 'five things'],
      nextStage: 'time-blocking'
    },
    {
      id: 'time-blocking',
      name: 'Time Blocking',
      goal: 'Protect time for what matters',
      systemPrompt: `"which priority needs your BEST energy? what time block can you protect?" start with ONE block, not a full redesign.`,
      completionSignals: ['blocked', 'protected', 'time for', 'scheduled', 'calendar'],
      nextStage: 'rituals'
    },
    {
      id: 'rituals',
      name: 'Rituals',
      goal: 'Build habits that reinforce the rhythm',
      systemPrompt: `"how do you want to start your day? end it? what's ONE ritual you'll commit to?" simple, enjoyable, ONE.`,
      completionSignals: ['ritual', 'morning', 'evening', 'weekly', 'will do'],
      nextStage: 'sustainability'
    },
    {
      id: 'sustainability',
      name: 'Sustainability Check',
      goal: 'Ensure the rhythm is maintainable',
      systemPrompt: `"what will make you abandon this in week 2?" need a minimum viable rhythm for bad weeks. when will you review?`,
      completionSignals: ['sustainable', 'will do', 'can do', 'review', 'tomorrow'],
      nextStage: null
    }
  ]
};
