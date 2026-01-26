import { Redis } from "@upstash/redis";

// Upstash Redis for serverless-compatible state
// Used for build tracking across function instances

// Only create Redis client if credentials are available
const hasRedisCredentials = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasRedisCredentials
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Fallback in-memory store (only works for same-instance requests)
// This is a temporary solution until Redis is configured
const memoryStore = new Map<string, BuildEntry>();

// Build entry structure stored in Redis
export interface BuildEntry {
  status: 'building' | 'complete' | 'error';
  startTime: number;
  deployedUrl?: string;
  document?: { title: string; content: string; type: string };
  error?: string;
}

// Key prefix for build entries
const BUILD_KEY_PREFIX = 'build:';

export async function setBuildEntry(buildId: string, entry: BuildEntry): Promise<void> {
  if (redis) {
    // Store with 10 minute TTL (builds should complete way before that)
    await redis.set(`${BUILD_KEY_PREFIX}${buildId}`, JSON.stringify(entry), { ex: 600 });
  } else {
    // Fallback to in-memory (won't work across serverless instances)
    console.warn('[REDIS] No credentials, using in-memory fallback');
    memoryStore.set(buildId, entry);
  }
}

export async function getBuildEntry(buildId: string): Promise<BuildEntry | null> {
  if (redis) {
    const data = await redis.get(`${BUILD_KEY_PREFIX}${buildId}`);
    if (!data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data as BuildEntry;
  } else {
    // Fallback to in-memory
    return memoryStore.get(buildId) || null;
  }
}

export async function updateBuildComplete(
  buildId: string,
  result: { deployedUrl?: string; document?: { title: string; content: string; type: string } }
): Promise<void> {
  const entry = await getBuildEntry(buildId);
  if (entry) {
    entry.status = 'complete';
    entry.deployedUrl = result.deployedUrl;
    entry.document = result.document;
    await setBuildEntry(buildId, entry);
  } else {
    // Entry not found - create a new complete entry
    // This can happen if Redis wasn't available when build started
    await setBuildEntry(buildId, {
      status: 'complete',
      startTime: Date.now(),
      deployedUrl: result.deployedUrl,
      document: result.document,
    });
  }
}

export async function updateBuildError(buildId: string, error: string): Promise<void> {
  const entry = await getBuildEntry(buildId);
  if (entry) {
    entry.status = 'error';
    entry.error = error;
    await setBuildEntry(buildId, entry);
  } else {
    // Entry not found - create error entry
    await setBuildEntry(buildId, {
      status: 'error',
      startTime: Date.now(),
      error,
    });
  }
}

// ============================================
// TASK STORAGE (for async tool execution)
// ============================================

export interface TaskEntry {
  status: 'running' | 'complete' | 'error';
  type: 'image' | 'email' | 'video' | 'audio' | 'other';
  startTime: number;
  description: string; // e.g., "Generating image..."
  result?: {
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    text?: string;
    data?: unknown;
  };
  error?: string;
}

const TASK_KEY_PREFIX = 'task:';
const taskMemoryStore = new Map<string, TaskEntry>();

export async function setTaskEntry(taskId: string, entry: TaskEntry): Promise<void> {
  console.log(`[REDIS] setTaskEntry: ${taskId}, status: ${entry.status}, hasRedis: ${!!redis}`);
  if (redis) {
    await redis.set(`${TASK_KEY_PREFIX}${taskId}`, JSON.stringify(entry), { ex: 300 }); // 5 min TTL
  } else {
    console.warn('[REDIS] No credentials, using in-memory fallback for task');
    taskMemoryStore.set(taskId, entry);
  }
}

export async function getTaskEntry(taskId: string): Promise<TaskEntry | null> {
  console.log(`[REDIS] getTaskEntry: ${taskId}, hasRedis: ${!!redis}`);
  if (redis) {
    const data = await redis.get(`${TASK_KEY_PREFIX}${taskId}`);
    console.log(`[REDIS] getTaskEntry result: ${data ? 'found' : 'not found'}`);
    if (!data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data as TaskEntry;
  } else {
    const entry = taskMemoryStore.get(taskId) || null;
    console.log(`[REDIS] getTaskEntry (memory): ${entry ? 'found' : 'not found'}`);
    return entry;
  }
}

export async function updateTaskComplete(
  taskId: string,
  result: TaskEntry['result']
): Promise<void> {
  const entry = await getTaskEntry(taskId);
  if (entry) {
    entry.status = 'complete';
    entry.result = result;
    await setTaskEntry(taskId, entry);
  }
}

export async function updateTaskError(taskId: string, error: string): Promise<void> {
  const entry = await getTaskEntry(taskId);
  if (entry) {
    entry.status = 'error';
    entry.error = error;
    await setTaskEntry(taskId, entry);
  }
}
