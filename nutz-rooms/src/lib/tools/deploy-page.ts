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
  const projectName = `${name}-demo`;

  const response = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: projectName,
      target: 'production',
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
    projectId: data.projectId,
    readyState: data.readyState,
  }, null, 2));

  // Disable SSO protection on the project to make it publicly accessible
  // Vercel enables "Standard Protection" by default which requires login
  if (data.projectId) {
    try {
      console.log('[DEPLOY] Disabling SSO protection for project:', data.projectId);
      const protectionResponse = await fetch(
        `https://api.vercel.com/v9/projects/${data.projectId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ssoProtection: null,  // Disable Vercel Authentication completely
          }),
        }
      );

      if (protectionResponse.ok) {
        console.log('[DEPLOY] SSO protection disabled successfully');
      } else {
        const protectionError = await protectionResponse.text();
        console.error('[DEPLOY] Failed to disable SSO protection:', protectionError);
      }
    } catch (err) {
      console.error('[DEPLOY] Error disabling SSO protection:', err);
    }
  }

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

CRITICAL REQUIREMENTS:
1. Include Tailwind via CDN: <script src="https://cdn.tailwindcss.com"></script>
2. Include viewport meta tag: <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
3. USER IS ON MOBILE - everything must be touch-friendly:
   - Use vw/vh units or percentages, NOT fixed pixel widths
   - For games: add TOUCH events (touchstart, touchmove, touchend), not just mouse
   - Add on-screen controls for games (d-pad, tap areas)
   - Buttons minimum 44px touch target
   - Canvas/game areas must scale to fit mobile viewport
4. Tetris needs arrow buttons at bottom, Connect4 needs tap-to-drop columns, etc.`,
  input_schema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Short name for URL (lowercase, no spaces, e.g. "bounce-game")',
      },
      code: {
        type: 'string',
        description: 'Full HTML page with inline CSS and JS. Include <!DOCTYPE html> and all necessary tags. MUST work on mobile touchscreens.',
      },
    },
    required: ['name', 'code'],
  },
};
