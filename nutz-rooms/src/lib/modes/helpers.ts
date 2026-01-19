import { clarityWalkMode } from './clarity-walk';
import { shipCycleMode } from './ship-cycle';
import { onePagerMode } from './1-pager';
import { thoughtPartnerMode } from './thought-partner';
import type { ModeConfig, ModeState, ToolkitMode } from './types';

const modes: Record<ToolkitMode, ModeConfig> = {
  'clarity-walk': clarityWalkMode,
  'ship-cycle': shipCycleMode,
  '1-pager': onePagerMode,
  'thought-partner': thoughtPartnerMode,
};

export function getMode(mode: ToolkitMode): ModeConfig {
  return modes[mode] || thoughtPartnerMode;
}

export function buildModePrompt(state: ModeState): string {
  const mode = getMode(state.mode);

  // For modes with no stages (like thought-partner), just return the base prompt
  if (mode.stages.length === 0) {
    return mode.systemPrompt;
  }

  const stage = mode.stages.find(s => s.id === state.currentStage);

  let prompt = mode.systemPrompt
    .replace('{stage}', stage?.name || 'Active')
    .replace('{stageGoal}', stage?.goal || '');

  if (stage?.systemPrompt) {
    prompt += '\n\n' + stage.systemPrompt;
  }

  return prompt;
}

export function getNextStageId(state: ModeState): string | null {
  const mode = getMode(state.mode);
  const currentStage = mode.stages.find(s => s.id === state.currentStage);
  return currentStage?.nextStage || null;
}

export function isValidMode(mode: string): mode is ToolkitMode {
  return mode in modes;
}
