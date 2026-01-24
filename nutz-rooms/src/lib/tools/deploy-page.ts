// Generic page deployment tool for Vercel
// Opus generates the code, this tool just deploys it

interface DeployPageInput {
  name: string;   // Short name for URL (lowercase, no spaces)
  code: string;   // Full HTML (with inline CSS/JS) for the page
}

interface DeployResult {
  url: string;
  deploymentId?: string;
}

/**
 * Deploy any HTML page to Vercel
 * Returns a live URL
 */
export async function deployPage(input: DeployPageInput): Promise<DeployResult> {
  const { name, code } = input;

  const response = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `${name}-demo`,
      target: 'production',  // Production deployments are public by default
      files: [
        {
          file: 'index.html',
          data: Buffer.from(code).toString('base64'),
          encoding: 'base64',
        },
      ],
      projectSettings: {
        framework: null,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vercel deployment failed: ${error}`);
  }

  const data = await response.json();

  // Log full response to debug URL issues
  console.log('[DEPLOY] Vercel API response:', JSON.stringify({
    url: data.url,
    alias: data.alias,
    name: data.name,
    id: data.id,
    readyState: data.readyState,
  }, null, 2));

  // Get the public URL - Vercel returns different formats:
  // - data.url: usually the deployment URL (e.g., "project-abc123.vercel.app")
  // - data.alias: array of aliases if configured
  // Make sure we have https:// prefix and it's a real public URL
  let publicUrl = data.url;

  // If it looks like a dashboard URL, construct the correct one
  if (publicUrl && publicUrl.includes('vercel.com/')) {
    // Dashboard URL detected, use alias or construct from name
    publicUrl = data.alias?.[0] || `${data.name}.vercel.app`;
  }

  // Ensure https:// prefix
  if (publicUrl && !publicUrl.startsWith('http')) {
    publicUrl = `https://${publicUrl}`;
  }

  console.log('[DEPLOY] Final public URL:', publicUrl);

  return {
    url: publicUrl,
    deploymentId: data.id,
  };
}

/**
 * Tool definition for Claude agent
 * Opus generates the right HTML based on what user needs
 */
export const DEPLOY_PAGE_TOOL = {
  name: 'deploy_page',
  description: `Generate and deploy any web page - landing pages, games, tools, demos, interactive prototypes, whatever the user needs. Returns a live URL.

You generate the full HTML (with inline CSS/JS). Examples of what you can build:
- Landing page with email signup
- Interactive game prototype
- Calculator or tool
- Quiz or survey
- Portfolio preview
- Dashboard mockup
- Anything that helps validate or demonstrate an idea

Include Tailwind via CDN for styling: <script src="https://cdn.tailwindcss.com"></script>
Make it mobile-friendly and visually polished.`,
  input_schema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Short name for URL (lowercase, no spaces, e.g. "bounce-game")',
      },
      code: {
        type: 'string',
        description: 'Full HTML page with inline CSS and JS. Include <!DOCTYPE html> and all necessary tags.',
      },
    },
    required: ['name', 'code'],
  },
};
