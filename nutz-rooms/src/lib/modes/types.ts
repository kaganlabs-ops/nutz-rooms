export type ToolkitMode =
  | 'clarity-walk'
  | 'ship-cycle'
  | '1-pager'
  | 'vision-to-values'
  | 'team-alignment'
  | 'rhythm'
  | 'deep-dive'
  | 'thought-partner';

export interface Stage {
  id: string;
  name: string;
  goal: string;
  systemPrompt: string;
  completionSignals: string[];
  nextStage: string | null;
}

export interface ModeConfig {
  id: ToolkitMode;
  name: string;
  description: string;
  stages: Stage[];
  systemPrompt: string;
  kaganContext: string; // Relevant facts/stories for this mode
}

export interface ModeState {
  mode: ToolkitMode;
  currentStage: string;
  stageData: Record<string, unknown>;
  startedAt: string;
}
