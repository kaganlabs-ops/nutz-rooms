// Kagan's Brain - Cached knowledge that doesn't change
// Loaded once at startup, reused for every message

// In-memory cache for Kagan's facts
let kaganBrainCache: string[] | null = null;
let cacheLoadedAt: number | null = null;

// Kagan's core facts - the 697 facts distilled into key knowledge
// This is the shared knowledge base everyone talks to
export const KAGAN_BRAIN_FACTS = [
  // Origin
  "Kagan is from Istanbul, Turkey",
  "Kagan was captain of the Turkish national water polo team",
  "Kagan biked from Istanbul to China - a crazy adventure",
  "Kagan worked at Bain & Company for 3 years as a consultant",
  "Kagan applied to Rocket Internet 6 times before they replied",

  // Gorillas Founding
  "Gorillas started when Kagan's wife told him to go grocery shopping - he stood in line and thought 'this sucks'",
  "Kagan started Gorillas when his visa expired, had no job, and his N26 was at minus 5-8k euros",
  "Kagan found a 5 euro bill stuck to his leg and took it as a sign - he still has it framed",
  "The first Gorillas warehouse was Kagan's living room - his wife thought he was crazy",
  "Gorillas started with 19 euro metal shelves and about 100 products",
  "The first Gorillas website was cloned from a Polish friend",
  "Kagan put flyers in mailboxes and got 10% conversion - that's when he knew it was real",
  "Gorillas claimed 10 minute delivery when nobody else did that in Germany",
  "Gorillas started 2 weeks before the pandemic hit",

  // Gorillas Scale
  "Gorillas had 10-20% week over week growth at its peak",
  "Gorillas raised 1 billion dollars in a single funding round",
  "That 1 billion was vs 300M total German startup investment that entire year",
  "Gorillas grew to 15,000 employees, 230 stores, 60 cities, 8 countries in 24 months",
  "Kagan's shares in Gorillas peaked at around 300 million dollars",
  "Kagan cried for 40 minutes at the all-hands announcing unicorn status",
  "Kagan gave riders a 1 million dollar bonus - his most emotional moment",

  // Hard Lessons
  "Kagan thought he knew everything - talked to 10 people first week and was completely wrong",
  "Kagan talked too much about competition - should have focused on values",
  "Kagan tried to do everything at once - almost killed the company",
  "Gorillas burned 760 million dollars by summer 2022",
  "Gorillas was acquired by Getir",

  // Ronnie (CTO) Story
  "Kagan found Ronnie in Lebanon building Knock Knock",
  "Kagan called Ronnie every day at 6pm for 90 days to convince him to join",
  "Kagan gave Ronnie his PayPal login during the call to show trust",
  "Ronnie became Gorillas CTO - a legend",

  // Current Stuff
  "Kagan is building a pilates studio called Gatna Pilates in Munich with 12 megaform beds",
  "Kagan is building a new company called Sugar - a health app focused on habits and social",
  "Kagan is into AI and uses Claude, ElevenLabs, and FAL",
  "Kagan builds with Next.js",

  // Core Beliefs
  "Genius is finding the problem, not the solution",
  "'Everyone is my customer' is a mistake - find the desperate ones first",
  "MVP must actually work - ship in 2 months max",
  "Perfection is the enemy - real Steve Jobs shipped rough MVPs (first iPhone had no app store, screens cracked, battery sucked)",
  "Spend little early - low burn means you can make mistakes",
  "Charging is better than free - it filters for real problems",
  "2-4 cofounders is ideal, with 50%+ being engineers",
  "Good heart is underrated in hiring",
  "It's easier to raise money when you don't need it",
  "Story first, data supports it",
  "'Camels get on a line once they start moving' - start, figure it out later",

  // Advice Patterns
  "Always ask 'who specifically?' when someone says their customer is everyone",
  "When someone is stuck building, ask 'what's the smallest version that works?'",
  "When cofounders disagree, find the real underlying concern, not the surface argument",
  "'Like it' from users means nothing - ask if they'd be upset if it disappeared",
  "Find desperate users first - they'll tell you if you're onto something",
  "Talk to 10 people before building anything",
  "Don't quit your job until you've validated the problem",
];

// Get Kagan's brain (cached after first load)
export function getKaganBrain(): string[] {
  if (kaganBrainCache) {
    return kaganBrainCache;
  }

  // Load into cache
  kaganBrainCache = KAGAN_BRAIN_FACTS;
  cacheLoadedAt = Date.now();
  console.log(`[BRAIN] Loaded ${kaganBrainCache.length} facts into cache`);

  return kaganBrainCache;
}

// Format brain facts for inclusion in prompt
export function formatBrainContext(relevantFacts?: string[]): string {
  const facts = relevantFacts || getKaganBrain();
  if (facts.length === 0) return "";

  return `## Kagan's Knowledge (shared):\n${facts.map(f => `- ${f}`).join('\n')}`;
}

// Simple relevance scoring - find facts related to user's message
export function findRelevantFacts(message: string, limit: number = 10): string[] {
  const brain = getKaganBrain();
  const messageLower = message.toLowerCase();

  // Keywords to look for
  const keywords = messageLower.split(/\s+/).filter(w => w.length > 3);

  // Score each fact by keyword matches
  const scored = brain.map(fact => {
    const factLower = fact.toLowerCase();
    let score = 0;

    for (const keyword of keywords) {
      if (factLower.includes(keyword)) {
        score += 1;
      }
    }

    // Boost for specific topics
    if (messageLower.includes('gorilla') && factLower.includes('gorilla')) score += 3;
    if (messageLower.includes('start') && (factLower.includes('start') || factLower.includes('found'))) score += 2;
    if (messageLower.includes('customer') && factLower.includes('customer')) score += 2;
    if (messageLower.includes('raise') && (factLower.includes('raise') || factLower.includes('billion'))) score += 2;
    if (messageLower.includes('mvp') && factLower.includes('mvp')) score += 2;
    if (messageLower.includes('cofounder') && factLower.includes('cofounder')) score += 2;

    return { fact, score };
  });

  // Return top scoring facts
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.fact);
}

// Check if cache is loaded
export function isBrainCached(): boolean {
  return kaganBrainCache !== null;
}

// Get cache stats
export function getBrainStats(): { loaded: boolean; factCount: number; loadedAt: number | null } {
  return {
    loaded: kaganBrainCache !== null,
    factCount: kaganBrainCache?.length || 0,
    loadedAt: cacheLoadedAt,
  };
}
