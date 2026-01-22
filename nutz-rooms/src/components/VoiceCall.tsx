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

// Summary extracted at end of call
interface CallSummary {
  oneThing: string | null;
  parkedItems: string[];
  insight: string | null;
  blocker: string | null;
}

// Active artifact task (generated in real-time during call)
interface ArtifactTask {
  id: string;
  status: 'pending' | 'done' | 'error';
  context: string;
  content?: string;
  createdAt: string;
}

// Trigger phrases that indicate Kagan is working on something
const ARTIFACT_TRIGGER_PHRASES = [
  "got you, working on it",
  "got you working on it",
  "on it, give me a sec",
  "on it give me a sec",
  "cool i got you",
  "cool, i got you",
  "let me put something together",
  "ill put something together",
  "working on it",
];

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
  const [callSummary, setCallSummary] = useState<CallSummary | null>(null);
  const [isExtractingSummary, setIsExtractingSummary] = useState(false);
  // Active artifact tasks (generated during call)
  const [artifactTasks, setArtifactTasks] = useState<ArtifactTask[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactTask | null>(null);
  const hasStarted = useRef(false);
  const hasSaved = useRef(false);
  const currentOneThing = useRef<string | null>(null);
  // Use ref for session metadata to avoid stale closures in useCallback
  const sessionMetadataRef = useRef<SessionMetadata | null>(null);
  // Track transcript in ref for artifact generation (avoids stale closure)
  const transcriptRef = useRef<Array<{ role: string; text: string }>>([]);

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

  // Check if Kagan's message contains a trigger phrase indicating artifact creation
  const checkForArtifactTrigger = (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return ARTIFACT_TRIGGER_PHRASES.some(phrase => lowerText.includes(phrase));
  };

  // Extract context from recent transcript for artifact generation
  const getRecentContext = (): string => {
    // Get last 10 messages or all if fewer
    const recent = transcriptRef.current.slice(-10);
    if (recent.length === 0) return "";

    // Find the user's request that Kagan is responding to
    // Look backwards from end for user message
    let userRequest = "";
    for (let i = recent.length - 1; i >= 0; i--) {
      if (recent[i].role === "user") {
        userRequest = recent[i].text;
        break;
      }
    }
    return userRequest;
  };

  // Fire off artifact generation (non-blocking)
  const triggerArtifactGeneration = async (context: string) => {
    const taskId = `task-${Date.now()}`;
    const task: ArtifactTask = {
      id: taskId,
      status: 'pending',
      context,
      createdAt: new Date().toISOString(),
    };

    // Add task immediately (shows "Working..." UI)
    setArtifactTasks(prev => {
      // Cap at 3 tasks
      const updated = [...prev, task];
      return updated.slice(-3);
    });

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

      if (!response.ok) {
        throw new Error('Failed to create artifact');
      }

      const data = await response.json();

      // Update task to done with content
      setArtifactTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, status: 'done' as const, content: data.content }
          : t
      ));

      console.log('[ARTIFACT] Generated artifact:', data.id);
    } catch (err) {
      console.error('[ARTIFACT] Generation failed:', err);
      // Update task to error state
      setArtifactTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, status: 'error' as const }
          : t
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

            // Update transcript state and ref
            const newMessage = { role, text: message.message };
            setTranscript((prev) => {
              const updated = [...prev, newMessage];
              transcriptRef.current = updated; // Keep ref in sync
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

        // Extract summary from transcript (shows card at end of call)
        setIsExtractingSummary(true);
        try {
          const summaryRes = await fetch("/api/extract-summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transcript: transcript.map(t => ({
                role: t.role,
                content: t.text,
              })),
              userId,
            }),
          });
          const summaryData = await summaryRes.json();
          console.log("[VOICE] Summary extracted:", summaryData);

          if (summaryData.hasContent) {
            setCallSummary({
              oneThing: summaryData.oneThing,
              parkedItems: summaryData.parkedItems || [],
              insight: summaryData.insight,
              blocker: summaryData.blocker,
            });
          }
        } catch (e) {
          console.error("[VOICE] Failed to extract summary:", e);
        } finally {
          setIsExtractingSummary(false);
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

      {/* Active Artifact Tasks */}
      {artifactTasks.length > 0 && (
        <div className="mx-4 mb-2 space-y-2">
          {artifactTasks.map((task) => (
            <button
              key={task.id}
              onClick={() => task.status === 'done' && setSelectedArtifact(task)}
              disabled={task.status === 'pending'}
              className={`w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 transition-all ${
                task.status === 'pending'
                  ? 'bg-white/5 border border-white/10'
                  : task.status === 'done'
                  ? 'bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-500/30 hover:border-green-500/50 cursor-pointer'
                  : 'bg-red-900/20 border border-red-500/30'
              }`}
            >
              {task.status === 'pending' && (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
              )}
              {task.status === 'done' && (
                <span className="text-green-400 text-lg">✓</span>
              )}
              {task.status === 'error' && (
                <span className="text-red-400 text-lg">✕</span>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-xs text-white/50 uppercase tracking-wide font-medium">
                  {task.status === 'pending' ? 'Working...' : task.status === 'done' ? 'Ready' : 'Failed'}
                </span>
                <p className="text-sm text-white/80 truncate">{task.context}</p>
              </div>
              {task.status === 'done' && (
                <span className="text-white/40 text-sm">Tap to view</span>
              )}
            </button>
          ))}
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
      </div>

      {/* End-of-call Summary Card */}
      {status === "idle" && (isExtractingSummary || callSummary) && (
        <div className="mx-4 mb-4">
          {isExtractingSummary ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <div className="animate-pulse text-white/60 text-sm">Extracting summary...</div>
            </div>
          ) : callSummary && (
            <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-white/80">
                <span className="text-lg">📋</span>
                <span className="font-medium">What we captured</span>
              </div>

              {callSummary.oneThing && (
                <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg px-3 py-2">
                  <div className="text-xs text-amber-400/80 uppercase tracking-wide font-medium">ONE THING</div>
                  <div className="text-white/90 text-sm">{callSummary.oneThing}</div>
                </div>
              )}

              {callSummary.parkedItems.length > 0 && (
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wide font-medium mb-1">Parked for later</div>
                  <ul className="space-y-1">
                    {callSummary.parkedItems.map((item, i) => (
                      <li key={i} className="text-white/70 text-sm flex items-start gap-2">
                        <span className="text-white/30">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {callSummary.insight && (
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wide font-medium mb-1">Key insight</div>
                  <div className="text-white/70 text-sm italic">&ldquo;{callSummary.insight}&rdquo;</div>
                </div>
              )}

              {callSummary.blocker && (
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wide font-medium mb-1">Blocker mentioned</div>
                  <div className="text-white/70 text-sm">{callSummary.blocker}</div>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full mt-2 bg-white/10 hover:bg-white/20 text-white/90 text-sm py-2 px-4 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          )}
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

      {/* Artifact Viewer Modal */}
      {selectedArtifact && (
        <div className="fixed inset-0 z-60 bg-black/95 flex flex-col">
          {/* Modal Header */}
          <div className="p-4 flex items-center justify-between border-b border-white/10">
            <button
              onClick={() => setSelectedArtifact(null)}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="text-white font-medium">Your Page</div>
            <div className="w-10" />
          </div>

          {/* Modal Content - Markdown Rendered */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto prose prose-invert prose-sm">
              {/* Simple markdown rendering - headers, lists, bold */}
              {selectedArtifact.content?.split('\n').map((line, i) => {
                // Headers
                if (line.startsWith('### ')) {
                  return <h3 key={i} className="text-lg font-semibold text-white mt-4 mb-2">{line.slice(4)}</h3>;
                }
                if (line.startsWith('## ')) {
                  return <h2 key={i} className="text-xl font-semibold text-white mt-6 mb-3">{line.slice(3)}</h2>;
                }
                if (line.startsWith('# ')) {
                  return <h1 key={i} className="text-2xl font-bold text-white mt-6 mb-4">{line.slice(2)}</h1>;
                }
                // Checkbox items
                if (line.startsWith('- [ ] ')) {
                  return (
                    <div key={i} className="flex items-start gap-2 text-white/80 my-1">
                      <span className="text-white/40 mt-0.5">☐</span>
                      <span>{line.slice(6)}</span>
                    </div>
                  );
                }
                if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
                  return (
                    <div key={i} className="flex items-start gap-2 text-white/60 my-1 line-through">
                      <span className="text-green-400 mt-0.5">☑</span>
                      <span>{line.slice(6)}</span>
                    </div>
                  );
                }
                // Bullet points
                if (line.startsWith('- ') || line.startsWith('* ')) {
                  return (
                    <div key={i} className="flex items-start gap-2 text-white/80 my-1">
                      <span className="text-white/40">•</span>
                      <span>{line.slice(2)}</span>
                    </div>
                  );
                }
                // Numbered lists
                const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
                if (numberedMatch) {
                  return (
                    <div key={i} className="flex items-start gap-2 text-white/80 my-1">
                      <span className="text-white/50 min-w-[1.5rem]">{numberedMatch[1]}.</span>
                      <span>{numberedMatch[2]}</span>
                    </div>
                  );
                }
                // Bold text (simple replacement)
                if (line.includes('**')) {
                  const parts = line.split(/\*\*(.+?)\*\*/g);
                  return (
                    <p key={i} className="text-white/80 my-2">
                      {parts.map((part, j) =>
                        j % 2 === 1 ? <strong key={j} className="text-white font-semibold">{part}</strong> : part
                      )}
                    </p>
                  );
                }
                // Empty lines
                if (line.trim() === '') {
                  return <div key={i} className="h-2" />;
                }
                // Regular paragraphs
                return <p key={i} className="text-white/80 my-2">{line}</p>;
              })}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={() => setSelectedArtifact(null)}
              className="w-full bg-white/10 hover:bg-white/20 text-white py-3 px-4 rounded-xl transition-colors font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
