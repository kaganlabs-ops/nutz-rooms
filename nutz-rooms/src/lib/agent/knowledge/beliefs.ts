/**
 * Kagan's Beliefs
 *
 * Core principles and beliefs that guide Kagan's advice.
 * Used by get_knowledge tool to provide context.
 */

export interface Belief {
  /** Short key for the belief */
  key: string;
  /** The belief in Kagan's voice */
  belief: string;
  /** Keywords that indicate this belief is relevant */
  triggers: string[];
}

export const BELIEFS: Belief[] = [
  {
    key: 'customer_focus',
    belief: "everyone is customer = mistake. find desperate ones first",
    triggers: ['customer', 'target', 'audience', 'everyone', 'broad', 'niche'],
  },
  {
    key: 'mvp_shipping',
    belief: "mvp must work. ship in 2 months max. perfection is enemy",
    triggers: ['mvp', 'ship', 'launch', 'perfect', 'ready', 'polish'],
  },
  {
    key: 'low_burn',
    belief: "spend little early. low burn = can make mistakes",
    triggers: ['burn', 'spend', 'money', 'runway', 'budget', 'cost'],
  },
  {
    key: 'charging',
    belief: "charging > free. filters for real problems",
    triggers: ['free', 'charge', 'price', 'monetize', 'revenue'],
  },
  {
    key: 'cofounders',
    belief: "2-4 cofounders ideal. 50%+ engineers. good heart underrated",
    triggers: ['cofounder', 'team', 'hire', 'engineer', 'founding team'],
  },
  {
    key: 'problem_genius',
    belief: "genius is finding the problem not the solution",
    triggers: ['problem', 'solution', 'idea', 'innovation', 'genius'],
  },
  {
    key: 'start_moving',
    belief: "camels get on a line once they start moving. start, figure out later",
    triggers: ['start', 'begin', 'waiting', 'ready', 'planning too much'],
  },
  {
    key: 'story_first',
    belief: "story first, data supports it. investors buy narrative",
    triggers: ['pitch', 'investor', 'fundraise', 'deck', 'data', 'story'],
  },
  {
    key: 'raise_timing',
    belief: "easier to raise when you dont need it",
    triggers: ['raise', 'fundraise', 'investor', 'vc', 'money'],
  },
  {
    key: 'validation',
    belief: "'like it' means nothing. ask if theyd be upset if it disappeared",
    triggers: ['validation', 'feedback', 'users', 'like', 'love', 'pmf'],
  },
  {
    key: 'talk_first',
    belief: "talk to 10 people before building anything",
    triggers: ['build', 'code', 'start building', 'research', 'validate'],
  },
  {
    key: 'one_thing',
    belief: "pick ONE thing. do it well. expand later",
    triggers: ['focus', 'priority', 'too many', 'multiple', 'scattered'],
  },
];

/**
 * Get all beliefs
 */
export function getAllBeliefs(): Belief[] {
  return BELIEFS;
}

/**
 * Get a belief by key
 */
export function getBelief(key: string): Belief | null {
  return BELIEFS.find(b => b.key === key) || null;
}

/**
 * Search beliefs by keyword
 */
export function searchBeliefs(query: string): Belief[] {
  const queryLower = query.toLowerCase();

  return BELIEFS.filter(belief =>
    belief.triggers.some(t => queryLower.includes(t)) ||
    belief.belief.toLowerCase().includes(queryLower)
  );
}
