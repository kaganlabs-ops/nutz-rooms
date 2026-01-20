import { detectMode, detectExplicitModeSwitch } from './router';
import { getMode, buildModePrompt } from './modes';
import type { ModeState, ToolkitMode } from './modes/types';
import { getModeState, saveModeState, clearModeState, isModeStateStale, searchGraph, addToGraph } from './zep';
import { openai, KAGAN_SYSTEM_PROMPT } from './openai';

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
  // Simple messages that don't need memory lookup (for faster responses)
  private simpleMessages = ['hey', 'hi', 'hello', 'yo', 'sup', 'whats up', "what's up", 'how are you', 'good morning', 'good evening'];

  private isSimpleMessage(message: string): boolean {
    const normalized = message.toLowerCase().trim();
    return this.simpleMessages.some(s => normalized === s || normalized.startsWith(s + ' '));
  }

  async process(ctx: ConversationContext): Promise<OrchestratorResponse> {
    const { userId, message, messageHistory = [] } = ctx;
    const startTime = Date.now();
    const isSimple = this.isSimpleMessage(message);
    console.log(`\n=== ORCHESTRATOR START ===`);
    console.log(`userId: ${userId}, message: "${message.slice(0, 50)}...", simple: ${isSimple}`);

    let memories: string[] = [];
    let modeState: ModeState | null = null;
    let modeChanged = false;
    let stageAdvanced = false;

    // Skip heavy processing for simple greetings
    if (isSimple) {
      // Fast path: just use base prompt, no memory/mode lookup
      const systemPrompt = KAGAN_SYSTEM_PROMPT;
      console.log(`[ORCH] Fast path - skipping memory/mode`);

      const llmStartTime = Date.now();
      const response = await this.callLLM(message, messageHistory, systemPrompt);
      console.log(`[ORCH] LLM call took ${Date.now() - llmStartTime}ms`);
      console.log(`[ORCH] Response: "${response.slice(0, 100)}..."`);
      console.log(`[ORCH] Total time: ${Date.now() - startTime}ms`);

      return { response, modeState: null, modeChanged: false, stageAdvanced: false };
    }

    // 1. Recall relevant memory
    const memoryStartTime = Date.now();
    const memoryResults = await searchGraph(userId, message);
    memories = memoryResults?.edges
      ?.map((e: { fact?: string }) => e.fact)
      .filter((f): f is string => Boolean(f)) || [];
    console.log(`[ORCH] Memory recall took ${Date.now() - memoryStartTime}ms, found ${memories.length} memories`);

    // 2. Get current mode state
    modeState = await getModeState(userId);

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
    console.log(`[ORCH] System prompt length: ${systemPrompt.length}, memories injected: ${memories.length}`);

    // 7. Call LLM
    const llmStartTime = Date.now();
    const response = await this.callLLM(message, messageHistory, systemPrompt);
    console.log(`[ORCH] LLM call took ${Date.now() - llmStartTime}ms`);
    console.log(`[ORCH] Response: "${response.slice(0, 100)}..."`);
    console.log(`[ORCH] Total time: ${Date.now() - startTime}ms`);

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

  private async callLLM(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt: string
  ): Promise<string> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 80,
      messages: messages,
    });

    let text = response.choices[0]?.message?.content || '';
    // Post-process: take first line only, strip newlines
    text = text.split('\n')[0].trim();
    return text;
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
