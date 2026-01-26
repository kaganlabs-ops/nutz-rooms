import FirecrawlApp from '@mendable/firecrawl-js';
import { Tool, ToolResult } from '@/types';

// Lazy initialization
let _firecrawl: FirecrawlApp | null = null;

function getFirecrawl(): FirecrawlApp {
  if (!_firecrawl) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error('FIRECRAWL_API_KEY environment variable is not set');
    }
    _firecrawl = new FirecrawlApp({ apiKey });
  }
  return _firecrawl;
}

// ============================================
// SCRAPE FUNCTION
// ============================================
export async function scrapeUrl(url: string, options?: {
  formats?: ('markdown' | 'html' | 'links')[];
}): Promise<{ markdown?: string; html?: string; links?: string[] }> {
  const firecrawl = getFirecrawl();
  const result = await firecrawl.scrape(url, {
    formats: options?.formats || ['markdown'],
  });

  return {
    markdown: result.markdown,
    html: result.html,
    links: result.links,
  };
}

// ============================================
// TOOL FOR AGENT
// ============================================
export const firecrawlTools: Tool[] = [
  {
    name: 'scrape_url',
    description: 'Scrape a webpage and extract its content as markdown. Use for research, competitive analysis, extracting data from websites.',
    parameters: {
      url: { type: 'string', description: 'URL to scrape', required: true },
      include_links: { type: 'boolean', description: 'Also extract all links from the page', required: false },
    },
    execute: async (params): Promise<ToolResult> => {
      try {
        const formats: ('markdown' | 'links')[] = ['markdown'];
        if (params.include_links) {
          formats.push('links');
        }
        const result = await scrapeUrl(params.url as string, { formats });
        return {
          success: true,
          data: {
            content: result.markdown,
            links: result.links,
          },
        };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Scrape failed' };
      }
    },
  },
];
