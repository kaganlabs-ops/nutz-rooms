import Anthropic from '@anthropic-ai/sdk';
import { toolRegistry, registerAllTools } from '@/lib/tools';
import { skillLoader } from '@/lib/agent/skill-loader';
import { kaganConfig } from '@/lib/creators/kagan';
import { mikeConfig } from '@/lib/creators/mike';
import { sarahConfig } from '@/lib/creators/sarah';
import { getConnectedApps } from '@/lib/integrations/composio';
import { ChatOptions, ChatResponse, CreatorConfig, BrainFact, SessionMetadata } from '@/types';

// All available creators
const CREATORS: Record<string, CreatorConfig> = {
  kagan: kaganConfig,
  mike: mikeConfig,
  sarah: sarahConfig,
};

// Export for use by other modules
export function getCreatorConfig(creatorId: string): CreatorConfig {
  return CREATORS[creatorId] || CREATORS.kagan;
}

export function getAllCreatorIds(): string[] {
  return Object.keys(CREATORS);
}

// Initialize tools on module load
let initialized = false;

async function ensureInitialized() {
  if (initialized) return;
  registerAllTools();
  await skillLoader.loadAll();
  initialized = true;
}

export class Agent {
  private creatorId: string;
  private userId: string;
  private config: CreatorConfig;
  private anthropic: Anthropic;

  constructor(creatorId: string, userId: string) {
    this.creatorId = creatorId;
    this.userId = userId;
    this.config = this.getCreatorConfigById(creatorId);
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
    console.log(`[AGENT] Created agent for creator: ${creatorId}, user: ${userId}`);
  }

  private getCreatorConfigById(id: string): CreatorConfig {
    const config = CREATORS[id];
    if (!config) {
      console.warn(`[AGENT] Unknown creator: ${id}, falling back to kagan`);
      return CREATORS.kagan;
    }
    return config;
  }

  /**
   * Main chat method - handles a single message and returns response
   */
  async chat(message: string, options: ChatOptions): Promise<ChatResponse> {
    await ensureInitialized();

    const { history, zepContext, brainFacts, sessionMetadata } = options;

    // Fetch user's connected apps and update registry
    const connectedApps = await getConnectedApps(this.userId);
    toolRegistry.setUserConnections(this.userId, connectedApps);
    console.log(`[AGENT] User ${this.userId} has connected apps:`, connectedApps);

    // Build system prompt with all context
    const systemPrompt = this.buildSystemPrompt({
      zepContext,
      brainFacts,
      sessionMetadata,
      message,
    });

    // Get tools available to this user (now filtered by connected apps)
    const tools = toolRegistry.getByNames(this.config.tools, this.userId);
    console.log(`[AGENT] Tools available to user:`, tools.map(t => t.name));
    const toolDefinitions = toolRegistry.getToolDefinitions(tools);
    console.log(`[AGENT] Tool definitions count:`, toolDefinitions.length);
    console.log(`[AGENT] Passing tools to Claude:`, toolDefinitions.map(t => t.name));

    // Truncate history to last 20 messages to avoid token limits
    const truncatedHistory = history.slice(-20);

    // Helper to parse attached image from message text
    const parseImageFromMessage = (text: string): { cleanText: string; imageUrl: string | null } => {
      const imageMatch = text.match(/\[Attached image: (https?:\/\/[^\]]+)\]/);
      if (imageMatch) {
        return {
          cleanText: text.replace(imageMatch[0], '').trim(),
          imageUrl: imageMatch[1],
        };
      }
      return { cleanText: text, imageUrl: null };
    };

    // Build messages array with proper image handling for Claude vision
    const messages: Anthropic.MessageParam[] = [
      ...truncatedHistory.map(m => {
        const { cleanText, imageUrl } = parseImageFromMessage(m.content);
        if (imageUrl && m.role === 'user') {
          // Include image as vision content
          return {
            role: m.role as 'user' | 'assistant',
            content: [
              { type: 'image' as const, source: { type: 'url' as const, url: imageUrl } },
              { type: 'text' as const, text: cleanText || 'What is in this image?' },
            ],
          };
        }
        return { role: m.role as 'user' | 'assistant', content: m.content };
      }),
    ];

    // Handle current message - check for attached image
    const { cleanText: currentCleanText, imageUrl: currentImageUrl } = parseImageFromMessage(message);
    if (currentImageUrl) {
      messages.push({
        role: 'user' as const,
        content: [
          { type: 'image' as const, source: { type: 'url' as const, url: currentImageUrl } },
          { type: 'text' as const, text: currentCleanText || 'What is in this image?' },
        ],
      });
    } else {
      messages.push({ role: 'user' as const, content: message });
    }

    // Call Claude with tool loop (handles multi-turn tool use)
    let currentMessages: Anthropic.MessageParam[] = messages;
    let finalText = '';
    let toolResults: Array<{ tool: string; result: unknown }> = [];
    let stopReason = 'end_turn';

    // Debug: Log prompt to verify no emojis in instructions
    console.log(`[AGENT] System prompt length: ${systemPrompt.length}`);
    console.log(`[AGENT] Prompt contains emoji instruction: ${systemPrompt.includes('NEVER use emojis')}`);
    console.log(`[AGENT] Messages count: ${currentMessages.length}`);

    // Check if any past messages have emojis
    const messagesWithEmojis = currentMessages.filter(m => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return /[\u{1F300}-\u{1F9FF}]/u.test(content);
    });
    if (messagesWithEmojis.length > 0) {
      console.log(`[AGENT] WARNING: ${messagesWithEmojis.length} past messages contain emojis!`);
    }

    // First Claude call
    const firstResponse = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: currentMessages,
      tools: toolDefinitions.length > 0 ? toolDefinitions as Anthropic.Tool[] : undefined,
    });

    stopReason = firstResponse.stop_reason || 'end_turn';

    // Collect text and tool uses from first response
    const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

    for (const block of firstResponse.content) {
      if (block.type === 'text') {
        finalText += block.text;
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    // If tools detected and caller wants early return, return now with continuation function
    if (toolUseBlocks.length > 0 && options.returnEarlyOnTools) {
      const pendingTools = toolUseBlocks.map(t => t.name);
      console.log(`[AGENT] Tools detected, returning early:`, pendingTools);

      // Create continuation function that executes tools and completes the response
      const continueExecution = async (): Promise<ChatResponse> => {
        return this.executeToolsAndComplete(
          toolUseBlocks,
          firstResponse,
          currentMessages,
          systemPrompt,
          toolDefinitions,
          connectedApps,
          finalText
        );
      };

      return {
        text: finalText || 'on it...',
        toolResults: [],
        oneThing: null,
        buildIntent: { shouldBuild: false, type: null },
        stopReason: 'tool_use',
        pendingTools,
        continueExecution,
      };
    }

    // No tools or not returning early - execute tools normally
    if (toolUseBlocks.length > 0) {
      const result = await this.executeToolsAndComplete(
        toolUseBlocks,
        firstResponse,
        currentMessages,
        systemPrompt,
        toolDefinitions,
        connectedApps,
        finalText
      );
      return result;
    }

    // Extract ONE THING if present
    const oneThing = this.extractOneThing(finalText);

    // Detect build intent
    const buildIntent = this.detectBuildIntent(finalText);

    return {
      text: finalText,
      toolResults,
      oneThing,
      buildIntent,
      stopReason,
    };
  }

  /**
   * Execute tools and complete the response (used for async tool execution)
   */
  private async executeToolsAndComplete(
    toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }>,
    firstResponse: Anthropic.Message,
    initialMessages: Anthropic.MessageParam[],
    systemPrompt: string,
    toolDefinitions: Array<{ name: string; description: string; input_schema: { type: 'object'; properties: Record<string, unknown>; required: string[] } }>,
    connectedApps: string[],
    initialText: string
  ): Promise<ChatResponse> {
    let currentMessages = initialMessages;
    let finalText = initialText;
    let toolResults: Array<{ tool: string; result: unknown }> = [];
    let stopReason = 'end_turn';

    // Execute first batch of tools
    const toolResultContents: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      console.log(`[AGENT] Executing tool: ${toolUse.name}`);
      const toolResult = await toolRegistry.execute(
        toolUse.name,
        toolUse.input,
        { userId: this.userId, creatorId: this.creatorId, connectedApps }
      );
      toolResults.push({ tool: toolUse.name, result: toolResult });

      let resultContent = JSON.stringify(toolResult);
      if (resultContent.length > 50000) {
        resultContent = resultContent.substring(0, 50000) + '...[truncated]';
      }

      toolResultContents.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: resultContent,
      });
    }

    // Add assistant response and tool results for next turn
    currentMessages = [
      ...currentMessages,
      { role: 'assistant' as const, content: firstResponse.content },
      { role: 'user' as const, content: toolResultContents },
    ];

    // Continue loop for additional tool calls (max 2 more iterations)
    for (let i = 0; i < 2; i++) {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: currentMessages,
        tools: toolDefinitions.length > 0 ? toolDefinitions as Anthropic.Tool[] : undefined,
      });

      stopReason = response.stop_reason || 'end_turn';

      const newToolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          finalText += block.text;
        } else if (block.type === 'tool_use') {
          newToolUseBlocks.push({
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          });
        }
      }

      if (newToolUseBlocks.length === 0) {
        break;
      }

      // Execute additional tools
      const newToolResultContents: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of newToolUseBlocks) {
        console.log(`[AGENT] Executing additional tool: ${toolUse.name}`);
        const toolResult = await toolRegistry.execute(
          toolUse.name,
          toolUse.input,
          { userId: this.userId, creatorId: this.creatorId, connectedApps }
        );
        toolResults.push({ tool: toolUse.name, result: toolResult });

        let resultContent = JSON.stringify(toolResult);
        if (resultContent.length > 50000) {
          resultContent = resultContent.substring(0, 50000) + '...[truncated]';
        }

        newToolResultContents.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: resultContent,
        });
      }

      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: newToolResultContents },
      ];

      if (stopReason === 'end_turn') {
        break;
      }
    }

    const oneThing = this.extractOneThing(finalText);
    const buildIntent = this.detectBuildIntent(finalText);

    return {
      text: finalText,
      toolResults,
      oneThing,
      buildIntent,
      stopReason,
    };
  }

  /**
   * Voice-specific chat - uses voice prompt
   */
  async voiceChat(message: string, options: ChatOptions): Promise<ChatResponse> {
    await ensureInitialized();

    const { history, zepContext, brainFacts, sessionMetadata } = options;

    // Fetch user's connected apps and update registry
    const connectedApps = await getConnectedApps(this.userId);
    toolRegistry.setUserConnections(this.userId, connectedApps);

    // Use voice prompt instead of base prompt
    const systemPrompt = this.buildVoiceSystemPrompt({
      zepContext,
      brainFacts,
      sessionMetadata,
      message,
    });

    // Get tools (filtered by connected apps)
    const tools = toolRegistry.getByNames(this.config.tools, this.userId);
    const toolDefinitions = toolRegistry.getToolDefinitions(tools);

    // Truncate history to last 20 messages
    const truncatedHistory = history.slice(-20);

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...truncatedHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: message },
    ];

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500, // Voice responses should be shorter
      system: systemPrompt,
      messages,
      tools: toolDefinitions.length > 0 ? toolDefinitions as Anthropic.Tool[] : undefined,
    });

    let finalText = '';
    let toolResults: Array<{ tool: string; result: unknown }> = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        finalText += block.text;
      } else if (block.type === 'tool_use') {
        const toolResult = await toolRegistry.execute(
          block.name,
          block.input as Record<string, unknown>,
          { userId: this.userId, creatorId: this.creatorId, connectedApps }
        );
        toolResults.push({ tool: block.name, result: toolResult });
      }
    }

    const oneThing = this.extractOneThing(finalText);
    const buildIntent = this.detectBuildIntent(finalText);

    return {
      text: finalText,
      toolResults,
      oneThing,
      buildIntent,
      stopReason: response.stop_reason || 'end_turn',
    };
  }

  /**
   * Build the main system prompt with all context
   */
  private buildSystemPrompt(context: {
    zepContext?: string | null;
    brainFacts?: BrainFact[];
    sessionMetadata?: SessionMetadata | null;
    message: string;
  }): string {
    const { zepContext, brainFacts, sessionMetadata, message } = context;

    let prompt = this.config.personality.basePrompt;

    // Add relevant skills based on message
    const relevantSkills = skillLoader.getRelevant(message, 3);
    if (relevantSkills.length > 0) {
      prompt += '\n\n' + skillLoader.buildSkillPrompt(relevantSkills);
    }

    // Add brain facts
    if (brainFacts && brainFacts.length > 0) {
      prompt += `\n\n## ${this.config.name.toUpperCase()}'S BRAIN (shared knowledge)\n`;
      for (const fact of brainFacts) {
        prompt += `- ${fact.fact}\n`;
      }
    }

    // Add session context
    if (sessionMetadata) {
      prompt += '\n\n## SESSION CONTEXT\n';
      prompt += this.buildSessionContext(sessionMetadata, zepContext);
    }

    // Check if there's real memory content
    const hasMemory = this.hasRealMemory(zepContext);

    // Add returning user instructions
    if (hasMemory || sessionMetadata?.lastOneThing || (sessionMetadata?.sessionCount || 0) > 1) {
      prompt += `\n\n## RETURNING USER RULES

You have context about this user above. USE IT - but ONE THING AT A TIME.

CRITICAL: Pick ONE topic to open with. Not everything at once.

BAD: "yo hows the move going? and did u work on that financial model? and are u still tired?"
GOOD: "yo hows the move going"

IF they had a ONE THING last session:
- Follow up on JUST that: "did u [action item]?"
- Wait for their response before asking about other stuff

NEVER ask multiple questions in one message.
NEVER make up memories. If context is empty, you're meeting them fresh.`;
    }

    // Add Zep memory
    if (hasMemory && zepContext) {
      prompt += `\n\n## ZEP MEMORY - What I know about this user:
${zepContext}

## CRITICAL MEMORY RULES:
1. USER_SUMMARY = long-term facts about who they are
2. FACTS = specific things from recent conversations with dates

IMPORTANT:
- Only reference things EXPLICITLY in the memory above
- NEVER make up or hallucinate conversations that aren't in FACTS
- If user says "remember when you said X" and its not in memory above, say "i dont remember that tbh"
- NEVER double down on fake memories. If you dont have it, you dont have it.`;
    } else if (!sessionMetadata?.sessionCount || sessionMetadata.sessionCount <= 1) {
      prompt += `\n\n## MEMORY:
NO MEMORY AVAILABLE. This is a new user.

CRITICAL:
- Do NOT make up or hallucinate past conversations
- If they say "remember X" or "you said Y" → say "nah i dont have that in my memory"
- NEVER pretend to remember something. NEVER double down on fake memories.`;
    }

    // Add tool instructions
    const tools = toolRegistry.getByNames(this.config.tools, this.userId);
    if (tools.length > 0) {
      prompt += '\n\n## AVAILABLE TOOLS\n';
      prompt += 'IMPORTANT: You MUST use these tools when the user asks for things they can do. Do NOT say you cannot do something if you have a tool for it.\n\n';
      for (const tool of tools) {
        prompt += `- ${tool.name}: ${tool.description}\n`;
      }
      prompt += '\nWhen user asks to read emails, USE the read_emails tool. When user asks to send email, USE the send_email tool. etc.';

      // Add image tool instructions
      prompt += `\n\n## IMAGE TOOL RULES - CRITICAL
When a user attaches/shares an image:
- FIRST: Just acknowledge and discuss the image (use your vision capability)
- DO NOT automatically call edit_image, remove_background, upscale_image, or generate_image
- ONLY use these image tools when the user EXPLICITLY asks for editing/manipulation

EXAMPLES:
- User sends photo + "what do you think?" → Just respond with your thoughts. NO TOOLS.
- User sends photo + "remove the background" → USE remove_background tool
- User sends photo + "make it better" → USE upscale_image or edit_image
- User sends photo + "edit this to add..." → USE edit_image tool

If unsure, ASK: "want me to edit this or just vibes?"`;
    }

    // Add referrals
    if (this.config.referrals.length > 0) {
      prompt += '\n\n## YOUR FRIENDS (mention naturally when relevant)\n';
      prompt += 'These are friends you can mention when the topic fits:\n';
      for (const ref of this.config.referrals) {
        prompt += `- ${ref.name}: ${ref.specialty}\n`;
      }
      prompt += `
IMPORTANT - HOW REFERRALS WORK:
- Mention your friend naturally in conversation (like "my friend mike" or "this guy mike")
- Ask if they want to connect ("want me to hook u up?")
- If they say yes, just acknowledge it ("bet, connecting u" or "cool, here u go")
- DO NOT send emails or take any action - the system shows a contact card automatically
- DO NOT use send_email tool for introductions to these friends
- Treat them as friends, not "agents" or "services"`;
    }

    return prompt;
  }

  /**
   * Build voice-specific system prompt
   */
  private buildVoiceSystemPrompt(context: {
    zepContext?: string | null;
    brainFacts?: BrainFact[];
    sessionMetadata?: SessionMetadata | null;
    message: string;
  }): string {
    const { zepContext, brainFacts, sessionMetadata, message } = context;

    // Use voice prompt as base
    let prompt = this.config.personality.voicePrompt || this.config.personality.basePrompt;

    // Add relevant skills (fewer for voice)
    const relevantSkills = skillLoader.getRelevant(message, 2);
    if (relevantSkills.length > 0) {
      prompt += '\n\n' + skillLoader.buildSkillPrompt(relevantSkills);
    }

    // Add brain facts (condensed for voice)
    if (brainFacts && brainFacts.length > 0) {
      prompt += '\n\n## CONTEXT\n';
      for (const fact of brainFacts.slice(0, 5)) {
        prompt += `- ${fact.fact}\n`;
      }
    }

    // Add session context
    if (sessionMetadata) {
      prompt += '\n\n## SESSION\n';
      prompt += this.buildSessionContext(sessionMetadata, zepContext);
    }

    // Add Zep memory (condensed)
    if (this.hasRealMemory(zepContext) && zepContext) {
      prompt += `\n\n## MEMORY\n${zepContext}`;
    }

    return prompt;
  }

  /**
   * Build session context string
   */
  private buildSessionContext(metadata: SessionMetadata, _zepContext?: string | null): string {
    const parts: string[] = [];

    if (metadata.sessionCount && metadata.sessionCount > 1) {
      parts.push(`Session count: ${metadata.sessionCount}`);
    }

    if (metadata.lastOneThing) {
      parts.push(`Last ONE THING: "${metadata.lastOneThing}"`);
    }

    if (metadata.daysSinceLastSession !== undefined) {
      if (metadata.daysSinceLastSession === 0) {
        parts.push('Returning same day');
      } else if (metadata.daysSinceLastSession === 1) {
        parts.push('Returning after 1 day');
      } else {
        parts.push(`Returning after ${metadata.daysSinceLastSession} days`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Check if Zep memory has real content
   */
  private hasRealMemory(zepContext?: string | null): boolean {
    if (!zepContext) return false;

    const hasUserSummary = zepContext.includes('<USER_SUMMARY>') &&
      !zepContext.includes('No other personal or lifestyle details are currently known');
    const hasRealFacts = zepContext.includes('<FACTS>') &&
      !zepContext.match(/<FACTS>\s*<\/FACTS>/) &&
      !zepContext.match(/<FACTS>\s*\n\s*<\/FACTS>/);

    return hasUserSummary || hasRealFacts;
  }

  /**
   * Extract ONE THING from response
   */
  private extractOneThing(text: string): string | null {
    // Look for "📌 ONE THING:" pattern
    const pinMatch = text.match(/📌\s*ONE\s*THING:\s*(.+?)(?:\n|$)/i);
    if (pinMatch) {
      return pinMatch[1].trim();
    }

    // Look for "ONE THING:" pattern (voice)
    const voiceMatch = text.match(/ONE\s*THING:\s*(.+?)(?:\n|$)/i);
    if (voiceMatch) {
      return voiceMatch[1].trim();
    }

    return null;
  }

  /**
   * Detect if response indicates build intent
   */
  private detectBuildIntent(text: string): { shouldBuild: boolean; type: 'build' | 'document' | null } {
    const lower = text.toLowerCase();

    const buildTriggers = [
      'building that now',
      'let me build that',
      'on it, building',
      'building you',
      'building u ',
      'let me build you',
      'let me build u',
      'gonna build',
      'let me build',
      'let me make you',
      'let me make u',
      'making you a',
      'making u a',
      'let me spin up',
      'spinning up',
      'let me create',
      'creating a prototype',
      'building a prototype',
      'i can build that',
      'ya i can build',
      'yeah i can build',
      'lemme build',
      'on it building',
      'building it now',
      'building rn',
    ];

    const docTriggers = [
      'let me put together some clarity',
      'let me organize',
      'putting together a plan',
      'let me outline',
      'writing up',
      'let me draft',
    ];

    if (buildTriggers.some(t => lower.includes(t))) {
      return { shouldBuild: true, type: 'build' };
    }

    if (docTriggers.some(t => lower.includes(t))) {
      return { shouldBuild: true, type: 'document' };
    }

    return { shouldBuild: false, type: null };
  }

  /**
   * Get creator config
   */
  getConfig(): CreatorConfig {
    return this.config;
  }

  /**
   * Get voice ID for ElevenLabs
   */
  getVoiceId(): string | undefined {
    return this.config.personality.voiceId;
  }
}

// Export singleton factory
export function createAgent(creatorId: string, userId: string): Agent {
  return new Agent(creatorId, userId);
}

// ============================================
// NEW ARCHITECTURE EXPORTS (Phase 1)
// ============================================
// These are the new lean prompt and tools from the refactoring plan.
// They will replace the existing architecture in Phase 2+.

// New lean prompt
export { getKaganPrompt, KAGAN_PERSONALITY } from './prompts/kagan-personality';

// New tools
export {
  GET_KNOWLEDGE_TOOL,
  getKnowledge,
  formatKnowledgeResult,
  handleGetKnowledge,
  type KnowledgeResult,
} from './tools/get-knowledge';

export {
  REFER_TO_AGENT_TOOL,
  referToAgent,
  handleReferToAgent,
  getAvailableAgents,
  AGENTS,
  type Agent as AgentInfo,
  type ReferralResult,
} from './tools/refer-to-agent';

export {
  CORE_TOOLS,
  getCoreToolDefinitions,
  executeTool,
  hasTool,
  getToolNames,
  getToolsForUser,
} from './tools/registry';

// New knowledge structure
export { STORIES, getStory, getStoryKeys, type Story } from './knowledge/stories';
export { FACTS, getFactCategories, getFactsForCategory, searchFacts, type FactCategory } from './knowledge/facts';
export { BELIEFS, getAllBeliefs, getBelief, searchBeliefs, type Belief } from './knowledge/beliefs';
