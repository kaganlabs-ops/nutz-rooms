/**
 * Tool Registry
 *
 * Single source of truth for all tools available to the agent.
 * Import tool definitions and handlers from individual tool files.
 */

import Anthropic from "@anthropic-ai/sdk";
import { GET_KNOWLEDGE_TOOL, handleGetKnowledge } from "./get-knowledge";
import { REFER_TO_AGENT_TOOL, handleReferToAgent, type ReferralResult } from "./refer-to-agent";

// Re-export types
export type { ReferralResult };

/**
 * Tool handler function type
 * Uses unknown input since Claude sends arbitrary JSON
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolHandler = (input: any) => unknown | Promise<unknown>;

/**
 * Tool registry entry
 */
interface ToolEntry {
  definition: Anthropic.Tool;
  handler: ToolHandler;
}

/**
 * Core tools that are always available
 */
export const CORE_TOOLS: Record<string, ToolEntry> = {
  get_knowledge: {
    definition: GET_KNOWLEDGE_TOOL,
    handler: (input) => handleGetKnowledge(input as { query: string; type?: string }),
  },
  refer_to_agent: {
    definition: REFER_TO_AGENT_TOOL,
    handler: (input) => handleReferToAgent(input as { agent_id: string; reason?: string }),
  },
};

/**
 * Get all core tool definitions for Claude
 */
export function getCoreToolDefinitions(): Anthropic.Tool[] {
  return Object.values(CORE_TOOLS).map(t => t.definition);
}

/**
 * Execute a core tool by name
 */
export async function executeTool(name: string, input: unknown): Promise<unknown> {
  const tool = CORE_TOOLS[name];
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return tool.handler(input);
}

/**
 * Check if a tool exists
 */
export function hasTool(name: string): boolean {
  return name in CORE_TOOLS;
}

/**
 * Get tool names
 */
export function getToolNames(): string[] {
  return Object.keys(CORE_TOOLS);
}

// ============================================
// Integration with existing tools
// ============================================
// These will be added in Phase 2 when we update the agent route
// For now, they're just type definitions for future use

/**
 * Extended tool registry including action tools (deploy_page, generate_image, etc)
 * This will be populated in Phase 2 when we integrate with existing tools
 */
export interface ExtendedToolRegistry {
  core: typeof CORE_TOOLS;
  actions: Record<string, ToolEntry>;
  composio: Record<string, ToolEntry>;
}

/**
 * Future: Get all tools for a user (including Composio connections)
 * This will be implemented in Phase 2
 */
export async function getToolsForUser(_userId: string): Promise<Anthropic.Tool[]> {
  // Phase 1: Just return core tools
  // Phase 2: Add action tools (deploy_page, generate_image, etc)
  // Phase 3: Add Composio tools based on user connections
  return getCoreToolDefinitions();
}
