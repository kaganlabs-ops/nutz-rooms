/**
 * refer_to_agent Tool
 *
 * Hands off conversation to another agent (Mike, Sarah, etc).
 * Replaces keyword-based detection in conversational-referral.ts.
 */

import Anthropic from "@anthropic-ai/sdk";

export const REFER_TO_AGENT_TOOL: Anthropic.Tool = {
  name: "refer_to_agent",
  description: `Hand off conversation to another agent. Use when:
- User explicitly asks for mike, sarah, or another agent
- User's needs would be better served by a specialist
- After helping with something outside your core (fitness→mike, stress→sarah)

Available agents:
- mike: Fitness, workouts, lifting, training programs, nutrition
- sarah: Meditation, mindfulness, stress, mental wellness, sleep
- kagan: Startups, business, building companies (you)

Call this tool to trigger the handoff. The UI will show a contact card.`,
  input_schema: {
    type: "object" as const,
    properties: {
      agent_id: {
        type: "string",
        enum: ["mike", "sarah", "kagan"],
        description: "Which agent to hand off to",
      },
      reason: {
        type: "string",
        description: "Brief reason for the handoff (optional, shown to user)",
      },
    },
    required: ["agent_id"],
  },
};

export interface Agent {
  id: string;
  name: string;
  domain: string;
  description: string;
}

export const AGENTS: Record<string, Agent> = {
  mike: {
    id: "mike",
    name: "Mike",
    domain: "Fitness",
    description: "Personal trainer specializing in strength training and nutrition",
  },
  sarah: {
    id: "sarah",
    name: "Sarah",
    domain: "Mindfulness",
    description: "Meditation and mindfulness coach for stress and mental wellness",
  },
  kagan: {
    id: "kagan",
    name: "Kagan",
    domain: "Startups",
    description: "Founder of Gorillas, startup advisor and entrepreneur",
  },
};

export interface ReferralResult {
  success: boolean;
  agent_id: string;
  agent_name: string;
  domain: string;
  reason?: string;
}

/**
 * Execute agent referral
 */
export function referToAgent(agentId: string, reason?: string): ReferralResult {
  const agent = AGENTS[agentId];

  if (!agent) {
    return {
      success: false,
      agent_id: agentId,
      agent_name: "",
      domain: "",
      reason: `Unknown agent: ${agentId}`,
    };
  }

  return {
    success: true,
    agent_id: agent.id,
    agent_name: agent.name,
    domain: agent.domain,
    reason,
  };
}

/**
 * Handler for the refer_to_agent tool (used by tool registry)
 */
export function handleReferToAgent(input: { agent_id: string; reason?: string }): ReferralResult {
  return referToAgent(input.agent_id, input.reason);
}

/**
 * Get available agents (for UI display)
 */
export function getAvailableAgents(): Agent[] {
  return Object.values(AGENTS);
}
