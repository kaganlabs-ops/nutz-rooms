/**
 * get_knowledge Tool
 *
 * Retrieves Kagan's personal knowledge - stories, facts, beliefs.
 * Claude calls this when it needs to share personal experiences.
 */

import Anthropic from "@anthropic-ai/sdk";
import { STORIES, type Story } from "../knowledge/stories";
import { FACTS, searchFacts } from "../knowledge/facts";
import { BELIEFS, searchBeliefs, type Belief } from "../knowledge/beliefs";

export const GET_KNOWLEDGE_TOOL: Anthropic.Tool = {
  name: "get_knowledge",
  description: `Retrieve SPECIFIC details about Kagan's experiences - only for deep dives.

IMPORTANT: You already know the key stories from your personality:
- Gorillas founding (living room, -5k euros, flyers in mailboxes, 10% conversion, Ronnie)
- Current projects (Gatna Pilates, Sugar)
- Background (water polo, Istanbul-China bike, Bain)

DO NOT call this tool for:
- Basic questions about Gorillas or your background (you already know it)
- General startup advice (use your personality)
- Simple conversations

ONLY call this tool when user asks for SPECIFIC details you don't have, like:
- Exact metrics from a specific fundraising round
- Names of specific team members
- Specific dates or timelines

Most conversations don't need this tool. Just respond from your personality.`,
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "What knowledge to retrieve (e.g. 'early traction', 'money', 'cofounder', 'mvp')",
      },
      type: {
        type: "string",
        enum: ["story", "fact", "belief", "all"],
        description: "Type of knowledge to retrieve (default: all)",
      },
    },
    required: ["query"],
  },
};

export interface KnowledgeResult {
  stories: string[];
  facts: string[];
  beliefs: string[];
  raw: {
    stories: Story[];
    beliefs: Belief[];
  };
}

/**
 * Find matching stories based on query
 */
function findMatchingStories(query: string): Story[] {
  const queryLower = query.toLowerCase();
  const matches: Story[] = [];

  for (const [key, story] of Object.entries(STORIES)) {
    // Check if query matches the key directly
    if (queryLower.includes(key.replace(/_/g, ' ')) || key.includes(queryLower.replace(/ /g, '_'))) {
      matches.push(story);
      continue;
    }

    // Check if query matches any triggers
    if (story.triggers.some(trigger => queryLower.includes(trigger) || trigger.includes(queryLower))) {
      matches.push(story);
    }
  }

  return matches;
}

/**
 * Get knowledge matching the query
 */
export function getKnowledge(query: string, type: string = 'all'): KnowledgeResult {
  const result: KnowledgeResult = {
    stories: [],
    facts: [],
    beliefs: [],
    raw: {
      stories: [],
      beliefs: [],
    },
  };

  const queryLower = query.toLowerCase();

  // Find matching stories
  if (type === 'story' || type === 'all') {
    const matchingStories = findMatchingStories(queryLower);
    result.raw.stories = matchingStories;
    result.stories = matchingStories.map(s => s.story);
  }

  // Find matching facts
  if (type === 'fact' || type === 'all') {
    result.facts = searchFacts(queryLower);

    // Also check fact categories by name
    for (const [category, data] of Object.entries(FACTS)) {
      if (queryLower.includes(category.replace(/_/g, ' '))) {
        result.facts.push(...data.facts.filter(f => !result.facts.includes(f)));
      }
    }
  }

  // Find matching beliefs
  if (type === 'belief' || type === 'all') {
    const matchingBeliefs = searchBeliefs(queryLower);
    result.raw.beliefs = matchingBeliefs;
    result.beliefs = matchingBeliefs.map(b => b.belief);
  }

  return result;
}

/**
 * Format knowledge result for Claude's response
 */
export function formatKnowledgeResult(result: KnowledgeResult): string {
  const parts: string[] = [];

  if (result.stories.length > 0) {
    parts.push(`## Stories\n${result.stories.map(s => `- ${s}`).join('\n')}`);
  }

  if (result.facts.length > 0) {
    parts.push(`## Facts\n${result.facts.map(f => `- ${f}`).join('\n')}`);
  }

  if (result.beliefs.length > 0) {
    parts.push(`## Beliefs\n${result.beliefs.map(b => `- ${b}`).join('\n')}`);
  }

  if (parts.length === 0) {
    return "No specific knowledge found for that query. Use your general knowledge about Kagan.";
  }

  return parts.join('\n\n');
}

/**
 * Handler for the get_knowledge tool (used by tool registry)
 */
export function handleGetKnowledge(input: { query: string; type?: string }): string {
  const result = getKnowledge(input.query, input.type || 'all');
  return formatKnowledgeResult(result);
}
