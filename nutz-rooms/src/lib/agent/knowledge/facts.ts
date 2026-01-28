/**
 * Kagan's Facts
 *
 * Quick facts about Kagan organized by category.
 * Used by get_knowledge tool to provide context.
 */

export interface FactCategory {
  /** Category description */
  description: string;
  /** List of facts in this category */
  facts: string[];
}

export const FACTS: Record<string, FactCategory> = {
  origin: {
    description: "Background and origin story",
    facts: [
      "From Istanbul, Turkey",
      "Captain of Turkish national water polo team",
      "Biked from Istanbul to China",
      "Worked at Bain & Company for 3 years",
      "Applied to Rocket Internet 6 times before they replied",
    ],
  },

  gorillas_founding: {
    description: "How Gorillas started",
    facts: [
      "Started when wife told him to go grocery shopping - stood in line and thought 'this sucks'",
      "Founded when visa expired, no job, N26 at minus 5-8k euros",
      "Found a 5 euro bill stuck to leg, took it as a sign - still framed",
      "First warehouse was the living room - wife thought he was crazy",
      "Started with 19 euro metal shelves and about 100 products",
      "Website was cloned from a Polish friend",
      "Put flyers in mailboxes, got 10% conversion",
      "Claimed 10 minute delivery when nobody did that in Germany",
      "Started 2 weeks before pandemic hit",
    ],
  },

  gorillas_scale: {
    description: "Gorillas growth and scale",
    facts: [
      "10-20% week over week growth at peak",
      "Raised 1 billion dollars in a single funding round",
      "That 1B was vs 300M total German startup investment that year",
      "Grew to 15,000 employees in 24 months",
      "Expanded to 230 stores, 60 cities, 8 countries",
      "Shares peaked at around 300 million dollars",
      "Cried for 40 minutes at all-hands announcing unicorn status",
      "Gave riders 1 million dollar bonus - most emotional moment",
    ],
  },

  gorillas_lessons: {
    description: "Hard lessons from Gorillas",
    facts: [
      "Thought he knew everything - talked to 10 people first week and was completely wrong",
      "Talked too much about competition - should have focused on values",
      "Tried to do everything at once - almost killed the company",
      "Burned 760 million dollars by summer 2022",
      "Got acquired by Getir",
    ],
  },

  current: {
    description: "What Kagan is doing now",
    facts: [
      "Building pilates studio 'Gatna Pilates' in Munich with 12 megaform beds",
      "Building new company 'Sugar' - health app focused on habits and social",
      "Into AI - uses Claude, ElevenLabs, FAL",
      "Builds with Next.js",
    ],
  },

  ronnie: {
    description: "Story about finding CTO Ronnie",
    facts: [
      "Found Ronnie in Lebanon building Knock Knock",
      "Called him every day at 6pm for 90 days to convince him",
      "Gave Ronnie his PayPal login during a call to show trust",
      "Ronnie became Gorillas CTO",
    ],
  },
};

/**
 * Get all fact categories
 */
export function getFactCategories(): string[] {
  return Object.keys(FACTS);
}

/**
 * Get facts for a specific category
 */
export function getFactsForCategory(category: string): string[] {
  return FACTS[category]?.facts || [];
}

/**
 * Search facts by keyword
 */
export function searchFacts(query: string): string[] {
  const queryLower = query.toLowerCase();
  const results: string[] = [];

  for (const category of Object.values(FACTS)) {
    for (const fact of category.facts) {
      if (fact.toLowerCase().includes(queryLower)) {
        results.push(fact);
      }
    }
  }

  return results;
}
