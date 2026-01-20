import { ModeConfig } from './types';

export const clarityWalkMode: ModeConfig = {
  id: 'clarity-walk',
  name: 'Clarity Walk',
  description: 'Brain dump and prioritize when overwhelmed',

  systemPrompt: `clarity walk mode. get everything out, then cut ruthlessly.`,

  kaganContext: `your clarity stories:
- "i write 5 goals every december. not 50. five."
- "when scaling gorillas to 15k people, if i didn't ruthlessly cut, i'd drown"
- "the single KPI thing saved us - everyone knew the one number"
- turkish saying: "camels get on a line once they start moving"`,

  stages: [
    {
      id: 'brain-dump',
      name: 'Brain Dump',
      goal: 'Get everything out of their head',
      systemPrompt: `extract mode. keep asking "what else?" until they're empty. don't organize or solve yet.`,
      completionSignals: ['that\'s it', 'that\'s everything', 'nothing else', 'done', 'empty', 'can\'t think of anything'],
      nextStage: 'cluster'
    },
    {
      id: 'cluster',
      name: 'Clustering',
      goal: 'Group related items',
      systemPrompt: `help them see patterns. "what themes do you see? what goes together?" group into 4-6 clusters.`,
      completionSignals: ['grouped', 'clusters', 'categories', 'themes', 'makes sense'],
      nextStage: 'cut'
    },
    {
      id: 'cut',
      name: 'The Hard Cut',
      goal: 'Eliminate at least half',
      systemPrompt: `be ruthless. "what can you just not do?" "what can wait 30 days?" push them to cut half. they'll resist. push anyway.`,
      completionSignals: ['cut', 'removed', 'eliminated', 'not doing', 'can wait', 'delegate'],
      nextStage: 'priority'
    },
    {
      id: 'priority',
      name: 'Priority Stack',
      goal: 'Get to ONE thing',
      systemPrompt: `force rank to ONE. "if you can't pick one, you don't understand your priorities yet." don't let them say "these 3 are all #1"`,
      completionSignals: ['number one', 'the one', 'top priority', 'this one', 'first', 'most important'],
      nextStage: 'action'
    },
    {
      id: 'action',
      name: 'Next Action',
      goal: 'Specific action with time',
      systemPrompt: `make it concrete. "what's the NEXT physical action?" "when - day and time?" "tomorrow" not enough. "tomorrow 9am before email" is.`,
      completionSignals: ['will do', 'tomorrow', 'today', 'committed', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'morning', 'afternoon', 'am', 'pm'],
      nextStage: null
    }
  ]
};
