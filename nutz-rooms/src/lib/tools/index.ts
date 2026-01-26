import { toolRegistry } from '@/lib/agent/tool-registry';
import { falTools } from '@/lib/integrations/fal';
import { composioQuickTools } from '@/lib/integrations/composio';
import { firecrawlTools } from '@/lib/integrations/firecrawl';
import { slidesTools } from '@/lib/integrations/slides';
import { Tool, ToolResult } from '@/types';
import { deployPage } from '@/lib/tools/deploy-page';

// ============================================
// BUILT-IN TOOLS
// ============================================

const webSearchTool: Tool = {
  name: 'web_search',
  description: 'Search the web for information. Use for competitor analysis, market research, finding documentation.',
  parameters: {
    query: { type: 'string', description: 'Search query', required: true },
    max_results: { type: 'number', description: 'Maximum results to return (default 5)', required: false },
  },
  execute: async (): Promise<ToolResult> => {
    // Web search is handled by Claude's built-in web_search tool
    // This is just a placeholder for the registry
    return { success: true, data: { note: 'Handled by Claude web_search' } };
  },
};

const deployPageTool: Tool = {
  name: 'deploy_page',
  description: `Generate and deploy any web page - landing pages, games, tools, demos, interactive prototypes. Returns a live URL.

You generate the full HTML (with inline CSS/JS). Include Tailwind via CDN.

CRITICAL - MOBILE FIRST:
- User is on mobile. Everything must work on touch screens.
- Add viewport meta tag
- Use vw/vh units, NOT fixed pixel widths
- For games: add TOUCH events (touchstart, touchmove, touchend)
- Buttons minimum 44px touch target`,
  parameters: {
    name: { type: 'string', description: 'Short name for URL (lowercase, no spaces)', required: true },
    code: { type: 'string', description: 'Full HTML page with inline CSS and JS', required: true },
  },
  execute: async (params): Promise<ToolResult> => {
    try {
      const result = await deployPage({
        name: params.name as string,
        code: params.code as string,
      });
      return { success: true, data: { url: result.url, deploymentId: result.deploymentId } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Deploy failed' };
    }
  },
};

const createDocumentTool: Tool = {
  name: 'create_document',
  description: `Create a markdown document. Use for:
- Planning docs (MVP scope, priorities, action plans)
- Clarity docs (ONE THING focus, parking lot)
- Outreach scripts, interview questions
- Meeting prep, decision docs`,
  parameters: {
    title: { type: 'string', description: 'Document title', required: true },
    content: { type: 'string', description: 'Full markdown content', required: true },
    type: {
      type: 'string',
      description: 'Document type',
      required: true,
      enum: ['clarity', 'mvp-scope', 'action-plan', 'outreach', 'meeting-prep', 'other'],
    },
  },
  execute: async (params): Promise<ToolResult> => {
    // Document is returned as data - client handles display
    return {
      success: true,
      data: {
        title: params.title,
        content: params.content,
        type: params.type,
      },
    };
  },
};

// ============================================
// REGISTER ALL TOOLS
// ============================================

export function registerAllTools(): void {
  // Built-in tools
  toolRegistry.register(webSearchTool);
  toolRegistry.register(deployPageTool);
  toolRegistry.register(createDocumentTool);

  // FAL tools (image, video, audio)
  toolRegistry.registerAll(falTools);

  // Composio quick tools (email, calendar, etc.)
  toolRegistry.registerAll(composioQuickTools);

  // Firecrawl tools (web scraping)
  toolRegistry.registerAll(firecrawlTools);

  // Slides tools (PowerPoint generation)
  toolRegistry.registerAll(slidesTools);

  console.log(`[TOOLS] Registered ${toolRegistry.listNames().length} tools`);
}

// Export for direct access
export { toolRegistry };
export { webSearchTool, deployPageTool, createDocumentTool };
