// Session metadata stored in localStorage (client-side)
// Tracks: last session time, ONE THING, session count

export interface SessionMetadata {
  lastSessionTimestamp: number;      // unix timestamp
  lastSessionThreadId: string;       // for fetching last convo (kept for backwards compat)
  recentThreadIds: string[];         // last N thread IDs for multi-session context
  lastOneThing: string | null;       // last action item
  lastOneThingDate: string | null;   // when it was set
  sessionCount: number;              // how many times they've talked
}

// Max number of recent threads to store
const MAX_RECENT_THREADS = 5;

// Get session metadata from localStorage
export function getSessionMetadata(userId: string): SessionMetadata | null {
  if (typeof window === 'undefined') return null;

  const data = localStorage.getItem(`session_${userId}`);
  return data ? JSON.parse(data) : null;
}

// Save session metadata to localStorage
export function saveSessionMetadata(userId: string, metadata: SessionMetadata): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(`session_${userId}`, JSON.stringify(metadata));
}

// Update metadata after each message (safest approach)
export function updateSessionAfterMessage(
  userId: string,
  threadId: string,
  oneThing: string | null
): void {
  const existing = getSessionMetadata(userId);

  // Build recent thread IDs array - add new thread at front, keep max N
  let recentThreadIds = existing?.recentThreadIds || [];
  if (threadId && !recentThreadIds.includes(threadId)) {
    recentThreadIds = [threadId, ...recentThreadIds].slice(0, MAX_RECENT_THREADS);
  }

  const updated: SessionMetadata = {
    lastSessionTimestamp: Date.now(),
    lastSessionThreadId: threadId,
    recentThreadIds,
    // Only update ONE THING if a new one was found
    lastOneThing: oneThing || existing?.lastOneThing || null,
    lastOneThingDate: oneThing ? new Date().toISOString() : existing?.lastOneThingDate || null,
    // Increment session count only on first message of a new session
    sessionCount: existing?.sessionCount || 0,
  };

  saveSessionMetadata(userId, updated);
}

// Increment session count (call at start of new session)
export function incrementSessionCount(userId: string): number {
  const existing = getSessionMetadata(userId);
  const newCount = (existing?.sessionCount || 0) + 1;

  if (existing) {
    saveSessionMetadata(userId, {
      ...existing,
      sessionCount: newCount,
    });
  } else {
    saveSessionMetadata(userId, {
      lastSessionTimestamp: Date.now(),
      lastSessionThreadId: '',
      recentThreadIds: [],
      lastOneThing: null,
      lastOneThingDate: null,
      sessionCount: newCount,
    });
  }

  return newCount;
}

// Clear ONE THING after it's been followed up on
export function clearOneThing(userId: string): void {
  const existing = getSessionMetadata(userId);
  if (existing) {
    saveSessionMetadata(userId, {
      ...existing,
      lastOneThing: null,
      lastOneThingDate: null,
    });
  }
}

// ============================================
// TIME CALCULATIONS
// ============================================

export type TimeSinceGap = 'minutes' | 'same_day' | 'few_days' | 'week_plus' | null;

export function getTimeSinceLastSession(metadata: SessionMetadata | null): TimeSinceGap {
  if (!metadata?.lastSessionTimestamp) return null;

  const now = Date.now();
  const diff = now - metadata.lastSessionTimestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 30) return 'minutes';
  if (hours < 24) return 'same_day';
  if (days < 7) return 'few_days';
  return 'week_plus';
}

// ============================================
// ONE THING EXTRACTION
// ============================================

export function extractOneThing(message: string): string | null {
  // Matches "📌 ONE THING:" or "ONE THING:"
  const patterns = [
    /📌\s*ONE THING:\s*(.+?)(?:\n|$)/i,
    /ONE THING:\s*(.+?)(?:\n|$)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

// ============================================
// SESSION CONTEXT BUILDER
// ============================================

export function buildSessionContext(
  metadata: SessionMetadata | null,
  zepContext: string | null
): string {
  const timeSince = getTimeSinceLastSession(metadata);

  let context = '';

  // Time context
  if (timeSince) {
    context += `## TIME SINCE LAST SESSION\n`;
    if (timeSince === 'minutes') {
      context += `- Gap: just minutes ago\n`;
      context += `- They JUST talked to you. Back very quickly.\n`;
      context += `- Opener: "back already?" or "hey again, whats up"\n`;
    } else if (timeSince === 'same_day') {
      context += `- Gap: same day, returning\n`;
      context += `- Opener: "hey again" - keep it casual\n`;
    } else if (timeSince === 'few_days') {
      context += `- Gap: been a few days\n`;
      context += `- Opener: "been a few days. hows [their project] going"\n`;
    } else if (timeSince === 'week_plus') {
      context += `- Gap: over a week\n`;
      context += `- Opener: "been a minute. whats new with [their project]"\n`;
    }
    context += '\n';
  }

  // Session count - relationship depth
  if (metadata?.sessionCount) {
    context += `## RELATIONSHIP\n`;
    context += `- This is session #${metadata.sessionCount + 1} with this user\n`;
    if (metadata.sessionCount >= 10) {
      context += `- You know each other well by now. Be more familiar.\n`;
    } else if (metadata.sessionCount >= 5) {
      context += `- You've talked several times. Not strangers.\n`;
    }
    context += '\n';
  }

  // Last ONE THING - critical to follow up
  if (metadata?.lastOneThing) {
    context += `## LAST ACTION ITEM (FOLLOW UP ON THIS!)\n`;
    context += `- They committed to: "${metadata.lastOneThing}"\n`;
    if (metadata.lastOneThingDate) {
      context += `- Date set: ${metadata.lastOneThingDate}\n`;
    }
    context += `- ASK about this early: "did u [action]?" or "how'd [action] go?"\n`;
    context += `- If they did it, acknowledge and move on\n`;
    context += `- If they didn't, thats fine, ask whats blocking them\n`;
    context += '\n';
  }

  // Zep profile context (user memory from previous sessions)
  if (zepContext && zepContext.length > 50) {
    context += `## USER MEMORY (from Zep)\n`;
    context += zepContext;
    context += '\n';
  }

  return context;
}

// ============================================
// API-FRIENDLY VERSION (for server-side)
// ============================================

// Build context from API-provided metadata (for server routes)
export function buildSessionContextFromAPI(
  metadata: {
    lastSessionTimestamp?: number;
    lastOneThing?: string | null;
    lastOneThingDate?: string | null;
    sessionCount?: number;
  } | null,
  zepContext: string | null
): string {
  if (!metadata) {
    return buildSessionContext(null, zepContext);
  }

  const fullMetadata: SessionMetadata = {
    lastSessionTimestamp: metadata.lastSessionTimestamp || 0,
    lastSessionThreadId: '',
    recentThreadIds: [],
    lastOneThing: metadata.lastOneThing || null,
    lastOneThingDate: metadata.lastOneThingDate || null,
    sessionCount: metadata.sessionCount || 0,
  };

  return buildSessionContext(fullMetadata, zepContext);
}
