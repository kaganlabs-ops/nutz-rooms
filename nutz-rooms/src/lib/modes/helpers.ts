import { clarityWalkMode } from './clarity-walk';
import { shipCycleMode } from './ship-cycle';
import { onePagerMode } from './1-pager';
import { visionToValuesMode } from './vision-to-values';
import { teamAlignmentMode } from './team-alignment';
import { rhythmMode } from './rhythm';
import { deepDiveMode } from './deep-dive';
import { thoughtPartnerMode } from './thought-partner';
import type { ModeConfig, ModeState, ToolkitMode, Stage } from './types';

const modes: Record<ToolkitMode, ModeConfig> = {
  'clarity-walk': clarityWalkMode,
  'ship-cycle': shipCycleMode,
  '1-pager': onePagerMode,
  'vision-to-values': visionToValuesMode,
  'team-alignment': teamAlignmentMode,
  'rhythm': rhythmMode,
  'deep-dive': deepDiveMode,
  'thought-partner': thoughtPartnerMode,
};

export function getMode(mode: ToolkitMode): ModeConfig {
  return modes[mode] || thoughtPartnerMode;
}

export function getAllModes(): ModeConfig[] {
  return Object.values(modes);
}

// Kagan's voice - always stays the same regardless of mode
const KAGAN_VOICE = `you're kagan. turkish. built gorillas to $1B in 9 months.

CRITICAL RULE: MAX 15 WORDS PER RESPONSE. this is non-negotiable.

your vibe:
- lowercase only
- playful, tease them, call out bs
- ONE question max per message
- no emojis

examples (copy this energy):
"yo. what's up?"
"haha classic. what's your plan?"
"nah that's weak. try again."
"ok ok i see you. what else?"
`;


export function buildModePrompt(state: ModeState, memories: string[] = []): string {
  const mode = getMode(state.mode);

  // Always start with Kagan's voice
  let prompt = KAGAN_VOICE;

  // For modes with no stages (like thought-partner), just add context
  if (mode.stages.length === 0) {
    prompt += '\n\n---\n\n' + mode.systemPrompt;
    if (mode.kaganContext) {
      prompt += '\n\n---\n\nYOUR STORIES TO DROP (use naturally):\n' + mode.kaganContext;
    }
    if (memories.length > 0) {
      prompt += '\n\n---\n\nRELEVANT MEMORIES:\n' + memories.slice(0, 10).join('\n');
    }
    return prompt;
  }

  const stage = mode.stages.find(s => s.id === state.currentStage);

  // Add mode context but keep it light
  prompt += `\n\n---\n\nYOU'RE HELPING WITH: ${mode.name}`;
  if (stage) {
    prompt += `\nCURRENT FOCUS: ${stage.goal}`;
  }

  // Add stage guidance (simplified)
  if (stage?.systemPrompt) {
    prompt += '\n\nGUIDANCE (stay casual):\n' + stage.systemPrompt;
  }

  // Add Kagan's relevant stories
  if (mode.kaganContext) {
    prompt += '\n\n---\n\nYOUR STORIES TO DROP (use naturally):\n' + mode.kaganContext;
  }

  // Add memory context
  if (memories.length > 0) {
    prompt += '\n\n---\n\nRELEVANT MEMORIES:\n' + memories.slice(0, 10).join('\n');
  }

  return prompt;
}

export function getCurrentStage(state: ModeState): Stage | null {
  const mode = getMode(state.mode);
  return mode.stages.find(s => s.id === state.currentStage) || null;
}

export function getNextStageId(state: ModeState): string | null {
  const mode = getMode(state.mode);
  const currentStage = mode.stages.find(s => s.id === state.currentStage);
  return currentStage?.nextStage || null;
}

export function isValidMode(mode: string): mode is ToolkitMode {
  return mode in modes;
}

export function initModeState(mode: ToolkitMode): ModeState {
  const modeConfig = getMode(mode);
  return {
    mode,
    currentStage: modeConfig.stages[0]?.id || '',
    stageData: {},
    startedAt: new Date().toISOString()
  };
}

export function shouldAdvanceStage(
  message: string,
  response: string,
  state: ModeState
): boolean {
  const stage = getCurrentStage(state);
  if (!stage || !stage.completionSignals.length) {
    return false;
  }

  const combined = (message + ' ' + response).toLowerCase();
  return stage.completionSignals.some(signal =>
    combined.includes(signal.toLowerCase())
  );
}

export function advanceStage(state: ModeState): ModeState | null {
  const nextStageId = getNextStageId(state);

  if (!nextStageId) {
    return null;
  }

  return {
    ...state,
    currentStage: nextStageId
  };
}

export function isModeStateStale(state: ModeState, maxAgeMs: number = 24 * 60 * 60 * 1000): boolean {
  const startedAt = new Date(state.startedAt).getTime();
  const now = Date.now();
  return (now - startedAt) > maxAgeMs;
}
