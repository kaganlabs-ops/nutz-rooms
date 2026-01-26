// ============================================
// TOOL TYPES
// ============================================
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
  requiresAuth?: string[]; // e.g., ['gmail', 'calendar']
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface ToolContext {
  userId: string;
  creatorId: string;
  connectedApps: string[];
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================
// SKILL TYPES
// ============================================
export interface Skill {
  name: string;
  slug: string;
  description: string;
  triggers: string[];
  content: string;
}

// ============================================
// CREATOR TYPES
// ============================================
export interface CreatorConfig {
  id: string;
  name: string;
  personality: {
    basePrompt: string;
    voicePrompt?: string;
    voiceId?: string;
    style?: string;
  };
  skills: string[];      // skill slugs
  tools: string[];       // tool names
  referrals: Referral[];
}

export interface Referral {
  id: string;
  name: string;
  specialty: string;
  trigger: string; // regex pattern
}

// ============================================
// AGENT TYPES
// ============================================
export interface ChatOptions {
  history: ChatMessage[];
  zepContext?: string | null;
  brainFacts?: BrainFact[];
  sessionMetadata?: SessionMetadata | null;
  returnEarlyOnTools?: boolean; // Return immediately when tools detected, before executing
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface BrainFact {
  fact: string;
  category?: string;
  keywords?: string[];
}

export interface SessionMetadata {
  sessionCount?: number;
  lastOneThing?: string;
  lastSessionTime?: string;
  daysSinceLastSession?: number;
}

export interface AgentResponse {
  message: string;
  toolCalls?: ToolCallResult[];
  referral?: string;
  oneThing?: string;
  buildId?: string;
}

export interface ToolCallResult {
  tool: string;
  params: Record<string, unknown>;
  result: ToolResult;
}

// ============================================
// CHAT RESPONSE TYPES
// ============================================
export interface ChatResponse {
  text: string;
  toolResults: Array<{ tool: string; result: unknown }>;
  oneThing: string | null;
  buildIntent: {
    shouldBuild: boolean;
    type: 'build' | 'document' | null;
  };
  stopReason: string;
  // For async tool detection
  pendingTools?: string[]; // Tools that will be executed (if returnEarlyOnTools=true)
  continueExecution?: () => Promise<ChatResponse>; // Call this to complete tool execution
}

