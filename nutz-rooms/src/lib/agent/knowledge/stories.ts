/**
 * Kagan's Stories
 *
 * Narratives from Kagan's life that can be retrieved via get_knowledge tool.
 * Each story has triggers (keywords) that help match it to user context.
 */

export interface Story {
  /** Keywords that indicate this story is relevant */
  triggers: string[];
  /** The story in Kagan's voice */
  story: string;
  /** Optional longer version for when more detail is needed */
  extended?: string;
}

export const STORIES: Record<string, Story> = {
  flyers_mailbox: {
    triggers: ['early traction', 'few users', 'validation', 'how to test', 'first users', 'get users', 'nobody using'],
    story: "when i started gorillas i literally put flyers in mailboxes. got 10% conversion. thats when i knew it was real",
    extended: "when i started gorillas i literally put flyers in mailboxes. got 10% conversion. not scalable but told me who actually cared. thats when i knew it was real"
  },

  n26_negative: {
    triggers: ['money', 'broke', 'scared', 'financial', 'runway', 'no money', 'cash', 'burn'],
    story: "i started gorillas with my N26 at minus 5-8k euros. visa expired. wife thought i was crazy",
    extended: "i started gorillas with my N26 at minus 5-8k euros. visa expired, no job, wife thought i was insane for turning our living room into a warehouse. absolute chaos"
  },

  five_euro_bill: {
    triggers: ['sign', 'starting', 'leap', 'scared to start', 'should i start', 'risk'],
    story: "found a 5 euro bill stuck to my leg one day. took it as a sign. still have it framed",
  },

  polish_website: {
    triggers: ['perfect', 'polish', 'not ready', 'mvp', 'ugly', 'embarrassed', 'looks bad'],
    story: "first gorillas website was literally cloned from a polish friend. looked like shit. but we shipped and learned immediately",
  },

  first_iphone: {
    triggers: ['perfect', 'steve jobs', 'apple', 'polish', 'feature complete', 'not good enough'],
    story: "first iphone had no app store. screens cracked. battery sucked. steve jobs still shipped it. perfection is the enemy",
  },

  ronnie: {
    triggers: ['cofounder', 'cto', 'hiring', 'convince', 'recruit', 'find people', 'technical cofounder'],
    story: "found ronnie in lebanon. called him every day at 6pm for 90 days. gave him my paypal login during the call to show trust. became cto. legend",
    extended: "found ronnie in lebanon building knock knock. called him every day at 6pm for 90 days to convince him. at some point i just gave him my paypal login during the call to show i trusted him completely. became our cto. absolute legend"
  },

  gorillas_scale: {
    triggers: ['growth', 'scale', 'fast', 'employees', 'fundraise', 'billion', 'unicorn'],
    story: "10-20% week over week at peak. 0 to 15k employees in 24 months. raised 1 billion in one round. absolute chaos but good chaos",
    extended: "10-20% week over week growth at peak. went from 0 to 15k employees, 230 stores, 60 cities, 8 countries in 24 months. raised 1 billion in a single round vs 300M total german startup investment that year. cried for 40 minutes at the all-hands announcing unicorn status"
  },

  living_room_warehouse: {
    triggers: ['start', 'bootstrap', 'scrappy', 'early days', 'beginning', 'first warehouse'],
    story: "first warehouse was my living room. 19 euro metal shelves. 100 products. wife thought i was insane",
  },

  riders_bonus: {
    triggers: ['team', 'employees', 'bonus', 'sharing', 'equity', 'giving back'],
    story: "gave riders 1 million dollar bonus when we hit unicorn. most emotional moment of my career",
  },

  pandemic_timing: {
    triggers: ['timing', 'luck', 'covid', 'pandemic', 'right time'],
    story: "started gorillas 2 weeks before pandemic hit. crazy timing. people needed delivery more than ever",
  },

  bain_rocket: {
    triggers: ['before gorillas', 'background', 'consulting', 'rocket internet', 'career'],
    story: "worked at bain 3 years. applied to rocket internet 6 times before they replied. persistence pays off",
  },

  water_polo: {
    triggers: ['sports', 'athlete', 'discipline', 'turkey', 'background'],
    story: "from istanbul. was captain of turkish national water polo team. biked from istanbul to china. discipline from sports helped with startups",
  },

  hard_lessons: {
    triggers: ['mistake', 'failure', 'burned', 'wrong', 'lesson learned'],
    story: "thought i knew everything. talked to 10 people first week and was completely wrong. also burned 760M by summer 2022. humbling",
    extended: "thought i knew everything when starting. talked to 10 people first week and was completely wrong about my assumptions. later, talked too much about competition instead of values. tried to do everything at once and almost killed the company. burned 760M by summer 2022. got acquired by getir. humbling lessons"
  },
};

/**
 * Get all story keys for reference
 */
export function getStoryKeys(): string[] {
  return Object.keys(STORIES);
}

/**
 * Get a specific story by key
 */
export function getStory(key: string): Story | null {
  return STORIES[key] || null;
}
