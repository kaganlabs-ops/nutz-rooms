"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Conversation } from "@elevenlabs/client";
import {
  getSessionMetadata,
  updateSessionAfterMessage,
  incrementSessionCount,
  buildSessionContext,
  getTimeSinceLastSession,
  type SessionMetadata,
} from "@/lib/sessionStorage";

// Helper to pick random item from array
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Clean ONE THING for follow-up (remove time refs like "by friday", "this week")
const cleanOneThingForFollowUp = (oneThing: string): string => {
  return oneThing
    .toLowerCase()
    .replace(/\s*(by|before|until|this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|today|tomorrow|eod|eow)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// Extract user interests from memory for personalized openers
const extractInterests = (userMemory: string | null): string[] => {
  if (!userMemory) return [];
  const interests: string[] = [];
  const memoryLower = userMemory.toLowerCase();

  // Sport/fitness
  if (memoryLower.includes('rugby')) interests.push('rugby');
  if (memoryLower.includes('pilates')) interests.push('pilates');
  if (memoryLower.includes('gym') || memoryLower.includes('workout')) interests.push('fitness');
  if (memoryLower.includes('yoga')) interests.push('yoga');
  if (memoryLower.includes('running') || memoryLower.includes('marathon')) interests.push('running');

  // Work/projects
  if (memoryLower.includes('startup') || memoryLower.includes('founder')) interests.push('startup');
  if (memoryLower.includes('building') || memoryLower.includes('shipping')) interests.push('building');

  return interests;
};

// Generate personalized opening message based on context
function getOpeningMessage(
  metadata: SessionMetadata | null,
  userMemory: string | null
): string {
  const timeSince = getTimeSinceLastSession(metadata);
  const sessionCount = metadata?.sessionCount || 0;
  const interests = extractInterests(userMemory);

  // Priority 1: Has action item (ONE THING) to follow up
  if (metadata?.lastOneThing) {
    const cleanedAction = cleanOneThingForFollowUp(metadata.lastOneThing);
    return pick([
      `yo! so did u ${cleanedAction}`,
      `alright lets hear it. did u ${cleanedAction}`,
      `first things first. did u ${cleanedAction}`,
    ]);
  }

  // Priority 2: Back within minutes — cheeky
  if (timeSince === 'minutes') {
    return pick([
      "already missed me? thats cute",
      "cant stay away huh",
      "back so fast? alright whats going on",
      "wow that was quick. u good?",
    ]);
  }

  // Priority 3: Same day return
  if (timeSince === 'same_day') {
    return pick([
      "twice in one day. im flattered",
      "round two! whats going on",
      "oh look whos back",
      "hey again. whats up",
    ]);
  }

  // Priority 4: Few days gap with interests
  if (timeSince === 'few_days' && interests.length > 0) {
    if (interests.includes('rugby')) {
      return pick([
        "hows the rugby king doing",
        "still tackling people?",
        "yo! hows rugby going",
      ]);
    }
    if (interests.includes('pilates')) {
      return pick([
        "hows the pilates going",
        "core still strong?",
      ]);
    }
    if (interests.includes('startup') || interests.includes('building')) {
      return pick([
        "ship anything yet?",
        "hows the project going",
        "yo! whats the status",
      ]);
    }
  }

  // Priority 5: Week+ gap with interests
  if (timeSince === 'week_plus' && interests.length > 0) {
    if (interests.includes('rugby')) {
      return pick([
        "hows the rugby king doing",
        "still tackling people?",
      ]);
    }
    if (interests.includes('pilates')) {
      return pick([
        "hows the pilates master",
        "core still strong?",
      ]);
    }
    if (interests.includes('startup') || interests.includes('building')) {
      return pick([
        "been a minute. ship anything?",
        "long time. hows the project",
      ]);
    }
  }

  // Priority 6: Few days gap — has memory but no specific interest
  if (userMemory && timeSince === 'few_days') {
    return pick([
      "been a few days. whats new",
      "yo! havent heard from u in a bit. whats going on",
      "there u are. whats up",
    ]);
  }

  // Priority 7: Week+ gap — has memory
  if (userMemory && timeSince === 'week_plus') {
    return pick([
      "look who remembered i exist",
      "thought u forgot about me",
      "been a minute. whats going on",
      "long time. whats new",
    ]);
  }

  // Priority 8: Week+ gap — no memory
  if (timeSince === 'week_plus') {
    return pick([
      "look who remembered i exist",
      "thought u forgot about me. whats up",
    ]);
  }

  // Priority 9: Loyal user (10+ sessions) — familiar tone
  if (sessionCount >= 10) {
    return pick([
      "yo. the usual?",
      "alright whats on ur mind today",
      "hey. whats going on",
    ]);
  }

  // Priority 10: Regular returning user (has memory)
  if (userMemory) {
    return pick([
      "yo whats up",
      "hey. whats going on",
      "yo. whats on ur mind",
    ]);
  }

  // Default: New user — simple opener
  return pick([
    "yo whats up",
    "hey. whats going on",
    "yo. what can i help u with",
  ]);
}

type CallStatus = "idle" | "connecting" | "connected" | "speaking" | "listening";

// Active artifact task (generated in real-time during call)
interface ArtifactTask {
  id: string;
  status: 'pending' | 'done' | 'error';
  context: string;
  content?: string;
}

// Patterns that indicate Kagan is committing to create something
// More flexible than exact phrases - looks for intent signals
const checkForArtifactIntent = (text: string): boolean => {
  const lower = text.toLowerCase();

  // Must have a "doing it" signal
  const doingSignals = [
    "working on it",
    "on it",
    "got it",
    "got you",
    "will do",
    "i'll do",
    "i can do",
    "let me",
    "give me a",
    "hold on",
    "one sec",
    "i'll get",
    "i'll make",
    "i'll put",
    "i'll format",
    "i'll have it",
    "i'll send",
    "i'll write",
    "sorting it",
    "handle it",
  ];

  // Must also have a "creating" context (avoid false positives on casual "got it")
  const createSignals = [
    "list",
    "pager",
    "ready",
    "format",
    "write",
    "make",
    "put together",
    "send it",
    "for you",
    "sorted",
    "shortly",
  ];

  const hasDoingSignal = doingSignals.some(s => lower.includes(s));
  const hasCreateSignal = createSignals.some(s => lower.includes(s));

  // Special cases that are strong enough on their own
  const strongSignals = [
    "working on it",
    "i'll have it ready",
    "let me put something together",
    "got you, working",
    "on it, give me",
  ];
  const hasStrongSignal = strongSignals.some(s => lower.includes(s));

  return hasStrongSignal || (hasDoingSignal && hasCreateSignal);
};

interface VoiceCallProps {
  agentId: string;
  characterName: string;
  userId: string;
  onClose: () => void;
}

export default function VoiceCall({ agentId, characterName, userId, onClose }: VoiceCallProps) {
  const [status, setStatus] = useState<CallStatus>("connecting");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [pinnedAction, setPinnedAction] = useState<string | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [artifactTasks, setArtifactTasks] = useState<ArtifactTask[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactTask | null>(null);
  const [copied, setCopied] = useState(false);
  const hasStarted = useRef(false);
  const hasSaved = useRef(false);
  const currentOneThing = useRef<string | null>(null);
  // Use ref for session metadata to avoid stale closures in useCallback
  const sessionMetadataRef = useRef<SessionMetadata | null>(null);
  // Track transcript in ref for artifact generation (avoids stale closure)
  const transcriptRef = useRef<Array<{ role: string; text: string }>>([]);
  // Store Zep context (includes Kagan's background) for artifact generation
  const zepContextRef = useRef<string>("");

  // Load session metadata on mount
  useEffect(() => {
    if (typeof window !== "undefined" && userId) {
      const metadata = getSessionMetadata(userId);

      // Load last ONE THING
      if (metadata?.lastOneThing) {
        setPinnedAction(metadata.lastOneThing);
        console.log('[VOICE] Loaded lastOneThing:', metadata.lastOneThing);
      }

      // Increment session count
      const newCount = incrementSessionCount(userId);
      console.log('[VOICE] Session count:', newCount);

      // Set metadata with updated count
      const updatedMetadata = metadata ? { ...metadata, sessionCount: newCount } : {
        lastSessionTimestamp: Date.now(),
        lastSessionThreadId: '',
        recentThreadIds: [],
        lastOneThing: null,
        lastOneThingDate: null,
        sessionCount: newCount,
      };

      // Store in ref for stable access in callbacks
      sessionMetadataRef.current = updatedMetadata;
      setSessionLoaded(true);

      console.log('[VOICE] Session metadata loaded:', updatedMetadata);
    }
  }, [userId]);

  // Extract ONE THING from voice transcript (spoken as "ONE THING:" or "so ONE THING:")
  const extractOneThing = (text: string): string | null => {
    // Match "ONE THING:" and capture everything after it to end of string
    const patterns = [
      /(?:ok so |so )?ONE THING[:\s]+(.+)$/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        // Clean up the captured text - remove trailing periods
        return match[1].trim().replace(/\.+$/, '');
      }
    }
    return null;
  };

  // Check if Kagan's message indicates artifact creation intent
  const checkForArtifactTrigger = (text: string): boolean => {
    return checkForArtifactIntent(text);
  };

  // Extract context from recent transcript for artifact generation
  const getRecentContext = (): string => {
    const recent = transcriptRef.current.slice(-10);
    if (recent.length === 0) return "";
    // Find the user's request that Kagan is responding to
    for (let i = recent.length - 1; i >= 0; i--) {
      if (recent[i].role === "user") {
        return recent[i].text;
      }
    }
    return "";
  };

  // Fire off artifact generation (non-blocking)
  const triggerArtifactGeneration = async (context: string) => {
    const taskId = `task-${Date.now()}`;
    const task: ArtifactTask = {
      id: taskId,
      status: 'pending',
      context,
    };

    // Add task immediately (shows "Working..." UI)
    setArtifactTasks(prev => [...prev, task].slice(-3)); // Cap at 3

    try {
      const response = await fetch('/api/create-artifact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          intent: "Help the user based on conversation",
          transcript: transcriptRef.current.map(t => ({
            role: t.role,
            content: t.text,
          })),
        }),
      });

      if (!response.ok) throw new Error('Failed to create artifact');

      const data = await response.json();

      // Update task to done with content
      setArtifactTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: 'done' as const, content: data.content } : t
      ));

      console.log('[ARTIFACT] Generated:', data.id);
    } catch (err) {
      console.error('[ARTIFACT] Generation failed:', err);
      setArtifactTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: 'error' as const } : t
      ));
    }
  };

  const startCall = useCallback(async () => {
    console.log("🔴🔴🔴 NEW CODE VERSION 2025-01-21 🔴🔴🔴");
    if (hasStarted.current) return;
    hasStarted.current = true;

    try {
      // Mic permission already granted from room page
      setStatus("connecting");
      setError(null);

      // Build session context for the voice call
      const sessionContext = buildSessionContext(sessionMetadataRef.current, null);

      // Fetch Zep context for the voice call (includes user memory)
      let zepContext = "";
      try {
        console.log("[VOICE] Fetching context for userId:", userId);
        const contextRes = await fetch("/api/voice-context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `Who is ${characterName}? What should I know about them?`,
            userId,
            // Pass last session thread ID for backwards compat
            lastSessionThreadId: sessionMetadataRef.current?.lastSessionThreadId || null,
            // Pass array of recent thread IDs for multi-session context
            recentThreadIds: sessionMetadataRef.current?.recentThreadIds || [],
            // Pass session metadata for context building
            sessionMetadata: sessionMetadataRef.current ? {
              lastSessionTimestamp: sessionMetadataRef.current.lastSessionTimestamp,
              lastOneThing: sessionMetadataRef.current.lastOneThing,
              lastOneThingDate: sessionMetadataRef.current.lastOneThingDate,
              sessionCount: sessionMetadataRef.current.sessionCount,
            } : null,
          }),
        });
        const contextData = await contextRes.json();
        zepContext = contextData.context || "";

        // Log context info
        console.log("=".repeat(50));
        console.log("[VOICE] CONTEXT RECEIVED - Total length:", zepContext.length);
        console.log("=".repeat(50));

        // Log Kagan's background (shortened)
        const kaganSection = zepContext.split("WHAT I REMEMBER ABOUT THIS USER:")[0];
        console.log("[VOICE] KAGAN'S BACKGROUND (preview):", kaganSection?.slice(0, 200) + "...");

        // Log user memory section
        const userMemorySection = zepContext.includes("WHAT I REMEMBER ABOUT THIS USER:")
          ? zepContext.split("WHAT I REMEMBER ABOUT THIS USER:")[1]
          : null;

        console.log("-".repeat(50));
        if (userMemorySection) {
          console.log("[VOICE] ✅ USER MEMORY FOUND:");
          console.log(userMemorySection.slice(0, 1000));
        } else {
          console.log("[VOICE] ❌ NO USER MEMORY in context");
        }
        console.log("=".repeat(50));
      } catch (e) {
        console.error("Failed to fetch Zep context:", e);
      }

      // Combine session context with Zep context for ElevenLabs
      let fullContext = sessionContext
        ? `${sessionContext}\n\n${zepContext}`
        : zepContext || "No additional context available.";

      // ElevenLabs has a limit on dynamic variable size - truncate if too large
      const MAX_CONTEXT_LENGTH = 8000;
      if (fullContext.length > MAX_CONTEXT_LENGTH) {
        console.log(`[VOICE] Context too large (${fullContext.length}), truncating to ${MAX_CONTEXT_LENGTH}`);
        fullContext = fullContext.slice(0, MAX_CONTEXT_LENGTH) + "\n\n[Context truncated...]";
      }
      console.log("[VOICE] Final context length:", fullContext.length);

      // Extract user memory section for opener generation
      console.log("[VOICE] About to extract userMemorySection...");
      const userMemorySection = zepContext.includes("WHAT I REMEMBER ABOUT THIS USER:")
        ? zepContext.split("WHAT I REMEMBER ABOUT THIS USER:")[1]
        : null;
      console.log("[VOICE] userMemorySection length:", userMemorySection?.length || 0);

      // Generate personalized opening message based on session context
      const rawOpeningMessage = getOpeningMessage(sessionMetadataRef.current, userMemorySection);
      const sanitizeForElevenLabs = (text: string): string => {
        return text
          .replace(/[^\w\s?.!,'-]/g, '')
          .slice(0, 200)
          .trim() || "hey whats up";
      };
      const openingMessage = sanitizeForElevenLabs(rawOpeningMessage);

      // Debug logging for opener
      console.log("[VOICE] Opening message:", openingMessage);
      console.log("[VOICE] Opening message length:", openingMessage.length);
      console.log("[VOICE] Session count:", sessionMetadataRef.current?.sessionCount);

      console.log("[VOICE] Starting ElevenLabs session with agentId:", agentId);
      console.log("[VOICE] Dynamic variables:", {
        opening_message: openingMessage,
        zep_context: fullContext.slice(0, 100) + "...",
        user_id: userId,
        session_count: String(sessionMetadataRef.current?.sessionCount || 1),
        last_one_thing: sessionMetadataRef.current?.lastOneThing || "",
      });

      const conv = await Conversation.startSession({
        agentId,
        connectionType: "websocket",
        // Pass opening_message via dynamicVariables to match {{opening_message}} in dashboard
        dynamicVariables: {
          opening_message: openingMessage,
          zep_context: fullContext,
          user_id: userId,
          session_count: String(sessionMetadataRef.current?.sessionCount || 1),
          last_one_thing: sessionMetadataRef.current?.lastOneThing || "",
        },
        onConnect: () => {
          console.log("[VOICE] ✅ Connected to ElevenLabs successfully");
          setStatus("connected");
        },
        onDisconnect: (reason) => {
          console.log("[VOICE] ❌ Disconnected from ElevenLabs, reason:", reason);
          setStatus("idle");
          setConversation(null);
        },
        onMessage: (message) => {
          console.log("Message:", message);
          if (message.message) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const source = (message as any).source || (message as any).source_type;
            const role = source === "user" ? "user" : "assistant";

            // Check for ONE THING in assistant messages
            if (role === "assistant") {
              const oneThing = extractOneThing(message.message);
              if (oneThing) {
                setPinnedAction(oneThing);
                currentOneThing.current = oneThing;
              }

              // Check for artifact trigger phrases
              if (checkForArtifactTrigger(message.message)) {
                console.log('[ARTIFACT] Trigger phrase detected:', message.message);
                const context = getRecentContext();
                if (context) {
                  triggerArtifactGeneration(context);
                }
              }
            }

            // Update transcript state and ref together
            const newMessage = { role, text: message.message };
            setTranscript((prev) => {
              const updated = [...prev, newMessage];
              transcriptRef.current = updated;
              return updated;
            });
          }
        },
        onModeChange: (mode) => {
          console.log("Mode changed:", mode);
          if (mode.mode === "speaking") {
            setStatus("speaking");
          } else if (mode.mode === "listening") {
            setStatus("listening");
          }
        },
        onError: (err) => {
          console.error("[VOICE] ElevenLabs error:", err);
          console.error("[VOICE] Error details:", JSON.stringify(err, null, 2));
          setError("Connection error. Please try again.");
          setStatus("idle");
        },
      });

      setConversation(conv);
    } catch (err) {
      console.error("Failed to start call:", err);
      setError("Connection failed. Please try again.");
      setStatus("idle");
      hasStarted.current = false;
    }
  }, [agentId, characterName, userId]);

  // Auto-start call when session metadata is loaded
  useEffect(() => {
    if (sessionLoaded) {
      startCall();
    }
  }, [sessionLoaded, startCall]);

  const endCall = useCallback(async () => {
    if (conversation) {
      await conversation.endSession();
      setConversation(null);
    }

    // Save transcript to Zep for memory persistence (only once)
    if (transcript.length > 0 && !hasSaved.current) {
      hasSaved.current = true;
      try {
        console.log("[VOICE] Saving transcript to Zep for userId:", userId);
        console.log("[VOICE] Message count:", transcript.length);
        const response = await fetch("/api/voice-save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            messages: transcript.map(t => ({
              role: t.role,
              content: t.text,
            })),
          }),
        });
        const data = await response.json();
        console.log("[VOICE] Transcript saved to Zep, threadId:", data.threadId);

        // Update session metadata after voice call
        if (data.threadId) {
          updateSessionAfterMessage(userId, data.threadId, currentOneThing.current);
          console.log("[VOICE] Session metadata updated");
        }
      } catch (e) {
        console.error("[VOICE] Failed to save transcript:", e);
      }
    }

    setStatus("idle");
  }, [conversation, transcript, userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (conversation) {
        conversation.endSession();
      }
    };
  }, [conversation]);

  const getStatusText = () => {
    switch (status) {
      case "connecting":
        return "Connecting...";
      case "connected":
        return "Connected";
      case "speaking":
        return `${characterName} is speaking...`;
      case "listening":
        return "Listening...";
      default:
        return "Tap to call";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "connecting":
        return "bg-yellow-500";
      case "connected":
      case "listening":
        return "bg-green-500";
      case "speaking":
        return "bg-blue-500";
      default:
        return "bg-white/20";
    }
  };

  // Handle clearing ONE THING
  const handleClearOneThing = () => {
    setPinnedAction(null);
    currentOneThing.current = null;
    // Also clear from localStorage
    if (userId) {
      const metadata = getSessionMetadata(userId);
      if (metadata) {
        const updated = { ...metadata, lastOneThing: null, lastOneThingDate: null };
        localStorage.setItem(`session_${userId}`, JSON.stringify(updated));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <button
          onClick={() => {
            endCall();
            onClose();
          }}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="text-center">
          <div className="text-white font-medium">Voice Call with {characterName}</div>
          <div className="text-white/40 text-xs font-mono">{userId?.slice(0, 20)}...</div>
        </div>
        <div className="w-10" />
      </div>

      {/* Pinned ONE THING Banner */}
      {pinnedAction && (
        <div className="mx-4 mb-2 bg-gradient-to-r from-amber-900/60 to-orange-900/60 border border-amber-500/40 rounded-xl px-4 py-3 flex items-center gap-2">
          <span className="text-lg">📌</span>
          <div className="flex-1 min-w-0">
            <span className="text-xs text-amber-400/80 uppercase tracking-wide font-medium">ONE THING</span>
            <p className="text-sm text-white/90">{pinnedAction}</p>
          </div>
          <button
            onClick={handleClearOneThing}
            className="text-white/40 hover:text-white/70 transition-colors p-1"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Status indicator */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        {/* Animated circle */}
        <div className="relative">
          <div
            className={`w-32 h-32 rounded-full ${getStatusColor()} transition-all duration-300 ${
              status === "speaking" ? "animate-pulse scale-110" : ""
            } ${status === "listening" ? "animate-pulse" : ""}`}
          />
          {status !== "idle" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
              </svg>
            </div>
          )}
        </div>

        {/* Status text */}
        <div className="text-center">
          <p className="text-white text-xl font-medium">{getStatusText()}</p>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>

        {/* Transcript */}
        {transcript.length > 0 && (
          <div className="w-full max-w-md max-h-48 overflow-y-auto px-4">
            {transcript.slice(-5).map((msg, i) => (
              <div
                key={i}
                className={`mb-2 text-sm ${
                  msg.role === "user" ? "text-blue-300 text-right" : "text-white/80"
                }`}
              >
                {msg.text}
              </div>
            ))}
          </div>
        )}

        {/* Artifact Tasks */}
        {artifactTasks.length > 0 && (
          <div className="w-full max-w-md px-4 space-y-2">
            {artifactTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => task.status === 'done' && setSelectedArtifact(task)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  task.status === 'pending'
                    ? 'bg-blue-900/40 border-blue-500/40 animate-pulse'
                    : task.status === 'done'
                    ? 'bg-green-900/40 border-green-500/40 hover:bg-green-900/60 cursor-pointer'
                    : 'bg-red-900/40 border-red-500/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {task.status === 'pending' ? '📝' : task.status === 'done' ? '✓' : '⚠️'}
                  </span>
                  <span className="text-sm text-white/80">
                    {task.status === 'pending' ? 'Working on it...' : task.status === 'done' ? 'Ready - tap to view' : 'Failed'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Artifact Modal */}
      {selectedArtifact && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-white font-medium">📋 What we captured</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedArtifact.content);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="text-white/40 hover:text-white/70 flex items-center gap-1 text-sm"
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setSelectedArtifact(null)}
                  className="text-white/40 hover:text-white/70"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <pre className="text-sm text-white/80 whitespace-pre-wrap font-sans">
                {selectedArtifact.content}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Call button */}
      <div className="p-8 flex justify-center">
        {status === "idle" ? (
          <button
            onClick={startCall}
            className="w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 transition-colors flex items-center justify-center"
          >
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
            </svg>
          </button>
        ) : (
          <button
            onClick={endCall}
            className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center"
          >
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.68-1.36-2.66-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
