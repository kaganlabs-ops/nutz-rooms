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

  // Create a shareable link for the deployment URL
  // This allows anyone with the link to access the deployment without Vercel login
  let shareableSecret: string | null = null;
  const deploymentUrl = data.url; // e.g., "project-abc123.vercel.app"

  if (deploymentUrl) {
    try {
      console.log('[DEPLOY] Creating shareable link for:', deploymentUrl);
      const shareableResponse = await fetch(
        `https://api.vercel.com/aliases/${encodeURIComponent(deploymentUrl)}/protection-bypass`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),  // No TTL = never expires
        }
      );

      if (shareableResponse.ok) {
        const shareableData = await shareableResponse.json();
        console.log('[DEPLOY] Shareable link response:', JSON.stringify(shareableData, null, 2));
        // Extract the shareable link secret from response
        if (shareableData.protectionBypass) {
          // Find the shareable-link type bypass
          const shareableLink = Object.entries(shareableData.protectionBypass).find(
            ([, value]) => (value as { scope: string }).scope === 'shareable-link'
          );
          if (shareableLink) {
            shareableSecret = shareableLink[0]; // The key is the secret
            console.log('[DEPLOY] Shareable link secret obtained');
          }
        }
      } else {
        const shareableError = await shareableResponse.text();
        console.error('[DEPLOY] Failed to create shareable link:', shareableError);
      }
    } catch (err) {
      console.error('[DEPLOY] Error creating shareable link:', err);
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

  // Append shareable link secret as query param if we got one
  if (shareableSecret) {
    publicUrl = `${publicUrl}?share=${shareableSecret}`;
    console.log('[DEPLOY] Added shareable link to URL');
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
