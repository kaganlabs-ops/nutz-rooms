export type ToolkitMode = 'clarity-walk' | 'ship-cycle' | '1-pager' | 'thought-partner';

export interface Stage {
  id: string;
  name: string;
  goal: string;
  systemPrompt: string;
  completionSignals: string[]; // Phrases that indicate stage is done
  nextStage: string | null;
}

export interface ModeConfig {
  id: ToolkitMode;
  name: string;
  description: string;
  stages: Stage[];
  systemPrompt: string; // Base prompt for this mode
}

export interface ModeState {
  mode: ToolkitMode;
  currentStage: string;
  stageData: Record<string, unknown>; // Data collected during stages
  startedAt: string;
}
