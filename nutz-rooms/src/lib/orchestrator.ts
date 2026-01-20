import { detectMode, detectExplicitModeSwitch } from './router';
import { getMode, buildModePrompt } from './modes';
import type { ModeState, ToolkitMode } from './modes/types';
import { getModeState, saveModeState, clearModeState, isModeStateStale, searchGraph, addToGraph } from './zep';
import { anthropic, KAGAN_SYSTEM_PROMPT } from './openai';

interface ConversationContext {
  userId: string;
  message: string;
  messageHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface OrchestratorResponse {
  response: string;
  modeState: ModeState | null;
  modeChanged: boolean;
  stageAdvanced: boolean;
}

export class Orchestrator {
  async process(ctx: ConversationContext): Promise<OrchestratorResponse> {
    const { userId, message, messageHistory = [] } = ctx;

    // 1. Recall relevant memory
    const memoryResults = await searchGraph(userId, message);
    const memories = memoryResults?.edges
      ?.map((e: { fact?: string }) => e.fact)
      .filter((f): f is string => Boolean(f)) || [];

    // 2. Get current mode state
    let modeState = await getModeState(userId);
    let modeChanged = false;
    let stageAdvanced = false;

    // 3. Check for stale mode state (older than 7 days)
    if (modeState && isModeStateStale(modeState)) {
      await clearModeState(userId, modeState.mode);
      modeState = null;
    }

    // 4. Check for explicit mode switch or exit
    const explicitMode = detectExplicitModeSwitch(message);
    if (explicitMode) {
      if (explicitMode === 'thought-partner') {
        // User wants to exit current mode
        if (modeState) {
          await clearModeState(userId, modeState.mode);
          modeState = null;
        }
      } else if (explicitMode !== modeState?.mode) {
        modeState = this.initModeState(explicitMode);
        modeChanged = true;
        await saveModeState(userId, modeState);
      }
    }

    // 5. If no active mode, detect from message
    if (!modeState && !explicitMode) {
      const detectedMode = detectMode(message, memories);
      if (detectedMode !== 'thought-partner') {
        modeState = this.initModeState(detectedMode);
        modeChanged = true;
        await saveModeState(userId, modeState);
      }
    }

    // 6. Build context-aware system prompt
    const systemPrompt = this.buildSystemPrompt(modeState, memories);

    // 7. Call Claude
    const response = await this.callClaude(message, messageHistory, systemPrompt);

    // 8. Check stage completion and advance (skip for modes with no stages)
    if (modeState && modeState.currentStage) {
      const shouldAdvance = this.shouldAdvanceStage(response, message, modeState);
      if (shouldAdvance) {
        const advanced = await this.advanceStage(userId, modeState);
        stageAdvanced = advanced;
        if (!advanced) {
          // Mode complete
          await clearModeState(userId, modeState.mode);
          modeState = null;
        } else {
          // Update modeState with new stage
          modeState = await getModeState(userId);
        }
      } else {
        // Save current state (in case stageData changed)
        await saveModeState(userId, modeState);
      }
    }

    // 9. Extract and save facts from conversation
    await this.extractAndSaveFacts(userId, message);

    return {
      response,
      modeState,
      modeChanged,
      stageAdvanced
    };
  }

  private initModeState(mode: ToolkitMode): ModeState {
    const modeConfig = getMode(mode);
    return {
      mode,
      currentStage: modeConfig.stages[0]?.id || '',
      stageData: {},
      startedAt: new Date().toISOString()
    };
  }

  private buildSystemPrompt(modeState: ModeState | null, memories: string[]): string {
    let prompt = '';

    if (modeState) {
      // buildModePrompt now includes kaganContext and memories
      prompt = buildModePrompt(modeState, memories);

      // Add mode context header
      const mode = getMode(modeState.mode);
      const stage = mode.stages.find(s => s.id === modeState.currentStage);
      if (stage) {
        prompt = `[ACTIVE MODE: ${mode.name} - Stage: ${stage.name}]\n\n` + prompt;
      }
    } else {
      prompt = KAGAN_SYSTEM_PROMPT;
      // Add memory context for thought-partner mode
      if (memories.length > 0) {
        prompt += `\n\n## Context from memory:\n${memories.slice(0, 10).join('\n')}`;
      }
    }

    return prompt;
  }

  private async callClaude(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt: string
  ): Promise<string> {
    const messages = [
      ...history,
      { role: 'user' as const, content: message }
    ];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      system: systemPrompt,
      messages: messages,
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text : '';
  }

  private shouldAdvanceStage(response: string, userMessage: string, state: ModeState): boolean {
    const mode = getMode(state.mode);
    const stage = mode.stages.find(s => s.id === state.currentStage);
    if (!stage || !stage.completionSignals.length) return false;

    const combined = (response + ' ' + userMessage).toLowerCase();
    return stage.completionSignals.some(signal => combined.includes(signal.toLowerCase()));
  }

  private async advanceStage(userId: string, state: ModeState): Promise<boolean> {
    const mode = getMode(state.mode);
    const currentStageIndex = mode.stages.findIndex(s => s.id === state.currentStage);
    const nextStage = mode.stages[currentStageIndex + 1];

    if (nextStage) {
      state.currentStage = nextStage.id;
      await saveModeState(userId, state);
      return true;
    }
    return false; // Mode complete
  }

  private async extractAndSaveFacts(userId: string, message: string): Promise<void> {
    // Simple fact extraction patterns
    const importantPatterns = [
      /i(?:'m| am) building (.+)/i,
      /my (?:startup|company|project) is (.+)/i,
      /i work (?:on|at) (.+)/i,
      /my name is (.+)/i,
      /i(?:'m| am) a (.+)/i,
      /i founded (.+)/i,
    ];

    for (const pattern of importantPatterns) {
      const match = message.match(pattern);
      if (match) {
        await addToGraph(userId, `User fact: ${match[0]}`);
        break; // Only save one fact per message
      }
    }
  }
}

export const orchestrator = new Orchestrator();
