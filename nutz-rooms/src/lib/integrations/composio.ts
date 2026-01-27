import { Composio } from '@composio/client';
import { Tool, ToolResult } from '@/types';

// Lazy initialization of Composio client to avoid build-time errors
let _composio: Composio | null = null;

function getComposio(): Composio {
  if (!_composio) {
    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) {
      throw new Error('COMPOSIO_API_KEY environment variable is not set');
    }
    _composio = new Composio({ apiKey });
  }
  return _composio;
}

// ============================================
// APP CATEGORIES
// ============================================
export const COMPOSIO_APPS = {
  // Communication
  email: ['gmail', 'outlook'],
  calendar: ['googlecalendar', 'outlookcalendar', 'calendly'],
  messaging: ['slack', 'discord', 'microsoftteams'],

  // Productivity
  notes: ['notion', 'evernote', 'coda'],
  tasks: ['todoist', 'asana', 'linear', 'trello', 'monday', 'clickup', 'jira'],
  storage: ['googledrive', 'dropbox', 'onedrive', 'box'],
  docs: ['googledocs', 'googlesheets', 'airtable'],

  // Social
  social: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'reddit'],

  // Developer
  dev: ['github', 'gitlab', 'bitbucket', 'vercel', 'netlify'],

  // CRM & Sales
  crm: ['salesforce', 'hubspot', 'pipedrive', 'apollo'],

  // Finance
  finance: ['stripe', 'quickbooks', 'plaid', 'brex', 'mercury'],

  // Marketing
  marketing: ['mailchimp', 'sendgrid', 'convertkit', 'mixpanel', 'segment'],

  // Design
  design: ['figma', 'canva', 'miro'],

  // Forms
  forms: ['typeform', 'googleforms', 'tally'],
};

export const ALL_COMPOSIO_APPS = Object.values(COMPOSIO_APPS).flat();

// ============================================
// AUTH CONFIG IDS (from Composio dashboard)
// Map app names to their Auth Config IDs
// ============================================
const AUTH_CONFIG_IDS: Record<string, string> = {
  gmail: 'ac_lIVIHmEekMBg',
  // Add more as you configure them in Composio:
  // googlecalendar: 'ac_xxx',
  // notion: 'ac_xxx',
  // twitter: 'ac_xxx',
  // github: 'ac_xxx',
  // slack: 'ac_xxx',
};

// ============================================
// CONNECTION MANAGEMENT
// ============================================
// Store pending connections to track OAuth flow
const pendingConnections: Map<string, { appName: string; connectionId: string }> = new Map();

export interface ConnectionResult {
  redirectUrl: string;
  connectionId: string;
}

export async function initiateConnection(userId: string, appName: string, callbackUrl?: string): Promise<ConnectionResult> {
  try {
    const composio = getComposio();

    // Use Auth Config ID if available
    const authConfigId = AUTH_CONFIG_IDS[appName];

    if (!authConfigId) {
      throw new Error(
        `Integration "${appName}" not configured. Add its Auth Config ID to AUTH_CONFIG_IDS in composio.ts`
      );
    }

    console.log(`[COMPOSIO] Initiating connection for app=${appName}, userId=${userId}, authConfigId=${authConfigId}, callback=${callbackUrl}`);

    // SDK types don't match runtime API - using type assertion
    const connectionParams: Record<string, unknown> = {
      auth_config: { id: authConfigId },
      connection: { entity_id: userId },
    };

    // Add redirect URL if provided
    if (callbackUrl) {
      connectionParams.redirect_url = callbackUrl;
    }

    const connection = await composio.connectedAccounts.create(
      connectionParams as unknown as Parameters<typeof composio.connectedAccounts.create>[0]
    );

    console.log('[COMPOSIO] Connection response:', JSON.stringify(connection, null, 2));

    const connectionId = (connection as { id?: string }).id || '';
    const redirectUrl = (connection as { redirect_url?: string }).redirect_url || '';

    // Store pending connection for this user
    if (connectionId) {
      pendingConnections.set(userId, { appName, connectionId });
      console.log(`[COMPOSIO] Stored pending connection for ${userId}: ${appName} (${connectionId})`);
    }

    return { redirectUrl, connectionId };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Check for common Composio errors
    if (errorMsg.includes('Bad Request') || errorMsg.includes('400')) {
      throw new Error(
        `Integration "${appName}" not configured. Set up this integration in your Composio dashboard first: https://app.composio.dev`
      );
    }

    console.error(`[COMPOSIO] Failed to initiate connection for ${appName}:`, err);
    throw err;
  }
}

export async function getConnectedApps(userId: string): Promise<string[]> {
  try {
    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) {
      console.error('[COMPOSIO] No API key');
      return [];
    }

    // Filter by entity_id (userId) to only get THIS user's connections
    const response = await fetch(
      `https://backend.composio.dev/api/v1/connectedAccounts?page=1&pageSize=50&user_uuid=${encodeURIComponent(userId)}`,
      { headers: { 'x-api-key': apiKey } }
    );

    if (!response.ok) {
      console.error('[COMPOSIO] Failed to fetch connections:', response.status);
      return [];
    }

    const data = await response.json();
    const items = data.items || [];

    // Extract unique active app names for THIS user
    const activeApps = new Set<string>();
    for (const conn of items) {
      if (conn.status === 'ACTIVE' && conn.appName) {
        activeApps.add(conn.appName);
      }
    }

    const result = Array.from(activeApps);
    console.log(`[COMPOSIO] Active connected apps for ${userId}:`, result);
    return result;
  } catch (err) {
    console.error(`[COMPOSIO] Failed to get connections:`, err);
    return [];
  }
}

export async function disconnectApp(_userId: string, connectionId: string): Promise<void> {
  try {
    const composio = getComposio();
    await composio.connectedAccounts.delete(connectionId);
  } catch (err) {
    console.error(`[COMPOSIO] Failed to disconnect ${connectionId}:`, err);
    throw err;
  }
}

// ============================================
// ACTION EXECUTION HELPER
// Uses @composio/client SDK for action execution
// ============================================
async function executeComposioAction(
  actionName: string,
  params: Record<string, unknown>,
  entityId: string
): Promise<ToolResult> {
  try {
    const composio = getComposio();

    console.log(`[COMPOSIO] Executing action: ${actionName} for user: ${entityId}`, params);

    // Use SDK's tools.execute method with the actual user's entity_id
    const result = await composio.tools.execute(actionName, {
      user_id: entityId,
      arguments: params,
    });

    console.log(`[COMPOSIO] Action ${actionName} succeeded:`, result);
    return { success: true, data: result };
  } catch (err) {
    console.error(`[COMPOSIO] Action ${actionName} failed:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Action execution failed'
    };
  }
}

// ============================================
// AVAILABLE APPS INFO
// ============================================
export function getAvailableApps() {
  return COMPOSIO_APPS;
}

export function getAppsByCategory(category: keyof typeof COMPOSIO_APPS) {
  return COMPOSIO_APPS[category];
}

// ============================================
// COMMON ACTIONS (Pre-built tools for frequent use cases)
// ============================================
export const composioQuickTools: Tool[] = [
  {
    name: 'send_email',
    description: 'Send an email via Gmail',
    parameters: {
      to: { type: 'string', description: 'Recipient email address', required: true },
      subject: { type: 'string', description: 'Email subject', required: true },
      body: { type: 'string', description: 'Email body (plain text or HTML)', required: true },
    },
    requiresAuth: ['gmail'],
    execute: async (params, context): Promise<ToolResult> => {
      return executeComposioAction('GMAIL_SEND_EMAIL', {
        recipient_email: params.to,
        subject: params.subject,
        body: params.body,
      }, context.userId);
    },
  },
  {
    name: 'create_calendar_event',
    description: 'Create a Google Calendar event',
    parameters: {
      title: { type: 'string', description: 'Event title', required: true },
      start_time: { type: 'string', description: 'Start time (ISO format)', required: true },
      end_time: { type: 'string', description: 'End time (ISO format)', required: true },
      description: { type: 'string', description: 'Event description', required: false },
    },
    requiresAuth: ['googlecalendar'],
    execute: async (params, context): Promise<ToolResult> => {
      return executeComposioAction('GOOGLECALENDAR_CREATE_EVENT', {
        summary: params.title,
        start: { dateTime: params.start_time },
        end: { dateTime: params.end_time },
        description: params.description,
      }, context.userId);
    },
  },
  {
    name: 'post_tweet',
    description: 'Post a tweet to Twitter/X',
    parameters: {
      text: { type: 'string', description: 'Tweet text (max 280 chars)', required: true },
    },
    requiresAuth: ['twitter'],
    execute: async (params, context): Promise<ToolResult> => {
      return executeComposioAction('TWITTER_CREATE_TWEET', {
        text: params.text,
      }, context.userId);
    },
  },
  {
    name: 'create_notion_page',
    description: 'Create a new page in Notion',
    parameters: {
      title: { type: 'string', description: 'Page title', required: true },
      content: { type: 'string', description: 'Page content (markdown)', required: true },
      parent_page_id: { type: 'string', description: 'Parent page ID (optional)', required: false },
    },
    requiresAuth: ['notion'],
    execute: async (params, context): Promise<ToolResult> => {
      return executeComposioAction('NOTION_CREATE_PAGE', {
        title: params.title,
        content: params.content,
        parent: params.parent_page_id ? { page_id: params.parent_page_id } : undefined,
      }, context.userId);
    },
  },
  {
    name: 'create_github_issue',
    description: 'Create a GitHub issue',
    parameters: {
      repo: { type: 'string', description: 'Repository (owner/repo format)', required: true },
      title: { type: 'string', description: 'Issue title', required: true },
      body: { type: 'string', description: 'Issue body (markdown)', required: true },
    },
    requiresAuth: ['github'],
    execute: async (params, context): Promise<ToolResult> => {
      const [owner, repo] = (params.repo as string).split('/');
      return executeComposioAction('GITHUB_CREATE_ISSUE', {
        owner,
        repo,
        title: params.title,
        body: params.body,
      }, context.userId);
    },
  },
  {
    name: 'read_emails',
    description: 'Read recent emails from Gmail inbox',
    parameters: {
      max_results: { type: 'number', description: 'Maximum emails to return (default 10)', required: false },
      query: { type: 'string', description: 'Search query (e.g., "from:someone@example.com")', required: false },
    },
    requiresAuth: ['gmail'],
    execute: async (params, context): Promise<ToolResult> => {
      return executeComposioAction('GMAIL_FETCH_EMAILS', {
        max_results: params.max_results || 10,
        query: params.query || '',
      }, context.userId);
    },
  },
  {
    name: 'list_calendar_events',
    description: 'List upcoming Google Calendar events',
    parameters: {
      max_results: { type: 'number', description: 'Maximum events to return (default 10)', required: false },
      time_min: { type: 'string', description: 'Start time filter (ISO format)', required: false },
      time_max: { type: 'string', description: 'End time filter (ISO format)', required: false },
    },
    requiresAuth: ['googlecalendar'],
    execute: async (params, context): Promise<ToolResult> => {
      return executeComposioAction('GOOGLECALENDAR_LIST_EVENTS', {
        maxResults: params.max_results || 10,
        timeMin: params.time_min || new Date().toISOString(),
        timeMax: params.time_max,
      }, context.userId);
    },
  },
];
