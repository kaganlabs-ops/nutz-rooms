import type { ToolkitMode } from './modes/types';

interface RouterRule {
  mode: ToolkitMode;
  keywords: string[];
  priority: number;
}

const ROUTER_RULES: RouterRule[] = [
  {
    mode: 'clarity-walk',
    keywords: ['overwhelmed', 'too much', "don't know where to start", 'stressed', 'chaos', 'brain dump', 'so many things', 'everything at once'],
    priority: 1
  },
  {
    mode: 'ship-cycle',
    keywords: ['build', 'ship', 'launch', 'startup', 'idea', 'prototype', 'mvp', 'customers', 'validate', 'fundraise', 'pitch'],
    priority: 2
  },
  {
    mode: '1-pager',
    keywords: ['explain', 'pitch', 'what is my thing', "can't describe", 'clarity on what', '1-pager', 'one pager', "can't articulate"],
    priority: 3
  },
  {
    mode: 'thought-partner',
    keywords: [], // Default fallback
    priority: 99
  }
];

export function detectMode(message: string, _memory?: string[]): ToolkitMode {
  const lowerMessage = message.toLowerCase();

  // Sort by priority and check keywords
  const sortedRules = [...ROUTER_RULES].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    if (rule.keywords.length === 0) continue; // Skip fallback in first pass
    if (rule.keywords.some(kw => lowerMessage.includes(kw))) {
      return rule.mode;
    }
  }

  return 'thought-partner';
}

// Check for explicit mode triggers (more specific phrases)
export function detectExplicitModeSwitch(message: string): ToolkitMode | null {
  const lower = message.toLowerCase();

  // Check for explicit EXIT first
  if (lower.includes('exit') || lower.includes('stop this') || lower.includes('nevermind') || lower.includes("let's just chat") || lower.includes('end mode')) {
    return 'thought-partner'; // Exit to default
  }

  // Explicit mode triggers
  if (lower.includes("let's do a clarity walk") || lower.includes('brain dump')) {
    return 'clarity-walk';
  }
  if (lower.includes('help me ship') || lower.includes('build something') || lower.includes('ship cycle')) {
    return 'ship-cycle';
  }
  if (lower.includes('1-pager') || lower.includes('one-pager') || lower.includes('help me explain')) {
    return '1-pager';
  }

  return null;
}
