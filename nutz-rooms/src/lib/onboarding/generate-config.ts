import { CreatorConfig } from "@/types";

export interface GeneratedPersonality {
  name: string;
  voiceTone: string;
  keyStories: string[];
  philosophy: string[];
  vocabulary: string[];
  expertise: string[];
  personality: string;
}

// Map expertise areas to skills
const SKILL_MAPPING: Record<string, string[]> = {
  // Business/Startup
  startup: ["business/pitch-deck", "business/fundraising", "business/business-model"],
  business: ["business/go-to-market", "business/pricing-strategy", "business/sales-strategy"],
  fundraising: ["business/fundraising", "business/investor-relations", "business/pitch-deck"],
  marketing: ["content/copywriting", "content/social-media", "content/email-marketing"],
  sales: ["business/sales-strategy", "business/customer-discovery", "business/partnerships"],

  // Tech
  programming: ["development/react-nextjs", "development/api-design", "development/backend"],
  coding: ["development/react-nextjs", "development/testing", "development/devops"],
  ai: ["development/ai-ml", "frameworks/first-principles"],
  data: ["development/database", "development/ai-ml"],
  product: ["design/ui-ux", "design/user-research", "frameworks/jobs-to-be-done"],

  // Design
  design: ["design/ui-ux", "design/branding", "design/prototyping"],
  ux: ["design/ui-ux", "design/user-research", "design/prototyping"],
  branding: ["design/branding", "content/copywriting", "content/landing-page"],

  // Content
  writing: ["content/copywriting", "content/landing-page", "content/seo"],
  content: ["content/social-media", "content/video-scripts", "content/email-marketing"],

  // Fitness
  fitness: ["fitness/workout-programming", "fitness/nutrition", "fitness/habit-building"],
  health: ["fitness/nutrition", "fitness/recovery", "fitness/habit-building"],
  workout: ["fitness/workout-programming", "fitness/recovery", "fitness/injury-prevention"],
  nutrition: ["fitness/nutrition", "fitness/habit-building"],

  // Mindfulness
  meditation: ["mindfulness/basics", "mindfulness/stress-management", "mindfulness/sleep"],
  mindfulness: ["mindfulness/basics", "mindfulness/focus", "mindfulness/breathing"],
  stress: ["mindfulness/stress-management", "mindfulness/breathing", "mindfulness/focus"],
  sleep: ["mindfulness/sleep", "mindfulness/stress-management"],

  // Generic
  default: ["frameworks/first-principles", "frameworks/decision-making"],
};

// Default tools based on expertise
const TOOL_MAPPING: Record<string, string[]> = {
  content: ["generate_image", "create_document", "web_search"],
  design: ["generate_image", "edit_image", "create_document"],
  development: ["deploy_page", "web_search", "create_document"],
  business: ["web_search", "create_document", "deploy_page"],
  fitness: ["create_document", "web_search"],
  mindfulness: ["create_document"],
  default: ["web_search", "create_document", "generate_image"],
};

// Infer skills from expertise areas
function inferSkills(expertise: string[]): string[] {
  const skills = new Set<string>();

  for (const area of expertise) {
    const areaLower = area.toLowerCase();

    // Check each mapping
    for (const [keyword, mappedSkills] of Object.entries(SKILL_MAPPING)) {
      if (areaLower.includes(keyword)) {
        mappedSkills.forEach((skill) => skills.add(skill));
      }
    }
  }

  // Add default skills if none matched
  if (skills.size === 0) {
    SKILL_MAPPING.default.forEach((skill) => skills.add(skill));
  }

  return Array.from(skills);
}

// Infer tools from expertise
function inferTools(expertise: string[]): string[] {
  const tools = new Set<string>();

  for (const area of expertise) {
    const areaLower = area.toLowerCase();

    for (const [keyword, mappedTools] of Object.entries(TOOL_MAPPING)) {
      if (areaLower.includes(keyword)) {
        mappedTools.forEach((tool) => tools.add(tool));
      }
    }
  }

  // Add default tools if none matched
  if (tools.size === 0) {
    TOOL_MAPPING.default.forEach((tool) => tools.add(tool));
  }

  return Array.from(tools);
}

// Generate creator ID from name
function generateCreatorId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Generate full CreatorConfig
export function generateCreatorConfig(personality: GeneratedPersonality): CreatorConfig {
  const id = generateCreatorId(personality.name);
  const skills = inferSkills(personality.expertise);
  const tools = inferTools(personality.expertise);

  return {
    id,
    name: personality.name,
    personality: {
      basePrompt: personality.personality,
      voicePrompt: convertToVoicePrompt(personality.personality),
      voiceId: undefined, // Will be assigned when ElevenLabs voice is cloned
      style: personality.voiceTone,
    },
    skills,
    tools,
    referrals: [], // Can be populated later
  };
}

// Convert chat prompt to voice-optimized prompt
function convertToVoicePrompt(chatPrompt: string): string {
  // Add voice-specific instructions
  const voicePrefix = `## VOICE MODE

same vibe as text but spoken naturally:
- full words when speaking (you, are, your)
- no emojis ever
- slightly longer sentences work better spoken
- ok to think out loud... "so like..."
- keep it conversational
- one question at a time. never two.

`;

  return voicePrefix + chatPrompt;
}

// Generate the TypeScript file content for the creator
export function generateCreatorFile(config: CreatorConfig): string {
  return `import { CreatorConfig } from '@/types';

// ${config.name}'s personality prompt
const ${config.id.toUpperCase().replace(/-/g, "_")}_BASE_PROMPT = \`${config.personality.basePrompt.replace(/`/g, "\\`")}\`;

// Voice-specific personality (spoken naturally)
const ${config.id.toUpperCase().replace(/-/g, "_")}_VOICE_PROMPT = \`${config.personality.voicePrompt?.replace(/`/g, "\\`") || ""}\`;

export const ${config.id}Config: CreatorConfig = {
  id: '${config.id}',
  name: '${config.name}',
  personality: {
    basePrompt: ${config.id.toUpperCase().replace(/-/g, "_")}_BASE_PROMPT,
    voicePrompt: ${config.id.toUpperCase().replace(/-/g, "_")}_VOICE_PROMPT,
    voiceId: ${config.personality.voiceId ? `'${config.personality.voiceId}'` : "undefined"}, // ElevenLabs voice ID
    style: '${config.personality.style}',
  },
  skills: [
${config.skills.map((s) => `    '${s}',`).join("\n")}
  ],
  tools: [
${config.tools.map((t) => `    '${t}',`).join("\n")}
  ],
  referrals: [
${config.referrals
  .map(
    (r) => `    {
      id: '${r.id}',
      name: '${r.name}',
      specialty: '${r.specialty}',
      trigger: '${r.trigger}',
    },`
  )
  .join("\n")}
  ],
};
`;
}

