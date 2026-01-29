import { CreatorConfig } from '@/types';
import { getKaganPrompt } from '@/lib/agent/prompts/kagan-personality';

// Use the lean personality prompt for both chat and voice
// This is the ~400 word prompt that user loved
const KAGAN_BASE_PROMPT = getKaganPrompt('chat');
const KAGAN_VOICE_PROMPT_LEAN = getKaganPrompt('voice');

// KAGAN_VOICE_PROMPT is now imported from the lean prompt file above (KAGAN_VOICE_PROMPT_LEAN)

export const kaganConfig: CreatorConfig = {
  id: 'kagan',
  name: 'Kagan Sumer',
  personality: {
    basePrompt: KAGAN_BASE_PROMPT,
    voicePrompt: KAGAN_VOICE_PROMPT_LEAN,
    voiceId: 'kagan-voice', // ElevenLabs voice ID
    style: 'direct, sassy, startup-focused',
  },
  skills: [
    // Business skills (12)
    'business/pitch-deck',
    'business/fundraising',
    'business/business-model',
    'business/go-to-market',
    'business/pricing-strategy',
    'business/competitive-analysis',
    'business/unit-economics',
    'business/hiring',
    'business/investor-relations',
    'business/customer-discovery',
    'business/sales-strategy',
    'business/partnerships',
    // Development skills (8)
    'development/react-nextjs',
    'development/api-design',
    'development/database',
    'development/testing',
    'development/devops',
    'development/mobile',
    'development/backend',
    'development/ai-ml',
    // Design skills (5)
    'design/ui-ux',
    'design/branding',
    'design/prototyping',
    'design/design-systems',
    'design/user-research',
    // Content skills (6)
    'content/landing-page',
    'content/copywriting',
    'content/email-marketing',
    'content/social-media',
    'content/seo',
    'content/video-scripts',
    // Frameworks (5)
    'frameworks/first-principles',
    'frameworks/jobs-to-be-done',
    'frameworks/lean-startup',
    'frameworks/growth-frameworks',
    'frameworks/decision-making',
  ],
  tools: [
    // Core tools
    'web_search',
    'deploy_page',
    'create_document',
    // Referral (knowledge is in personality prompt now)
    'refer_to_agent',
    // FAL tools
    'generate_image',
    'edit_image',
    'remove_background',
    'generate_video',
    // Composio tools (when connected)
    'send_email',
    'read_emails',
    'create_calendar_event',
    'list_calendar_events',
    'post_tweet',
    'create_notion_page',
    'create_github_issue',
    // Firecrawl tools
    'scrape_url',
    // Slides tools
    'create_slides',
  ],
  referrals: [
    {
      id: 'mike',
      name: 'Mike',
      specialty: 'Fitness coach specializing in strength training and mobility',
      trigger: 'fitness|workout|gym|exercise|strength|lifting|mobility',
    },
    {
      id: 'sarah',
      name: 'Sarah',
      specialty: 'Mindfulness and meditation coach',
      trigger: 'meditation|mindfulness|stress|anxiety|calm|breathing|mental health',
    },
  ],
};
