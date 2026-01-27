"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import ArtifactCard from "@/components/ArtifactCard";
import type { Artifact } from "@/lib/artifacts";
import {
  getSessionMetadata,
  updateSessionAfterMessage,
  incrementSessionCount,
  type SessionMetadata,
} from "@/lib/sessionStorage";
import { useAuth } from "@/hooks/useAuth";
import { UnlockAgentsModal } from "@/components/UnlockAgentsModal";

interface Message {
  role: "user" | "assistant";
  content: string;
  artifact?: Artifact | null;
  gifUrl?: string | null;
  imageUrl?: string | null; // Generated images from FAL
  videoUrl?: string | null; // Generated videos
  audioUrl?: string | null; // Generated audio/music
  deployedUrl?: string | null;
  agentDocument?: { title: string; content: string; type: string } | null;
  isBuilding?: boolean; // Shows building indicator
  buildId?: string | null; // For polling build status
  taskId?: string | null; // For polling async task status
}

// Active build state for pinned banner
interface ActiveBuild {
  buildId: string;
  startTime: number;
  stage: 'generating' | 'deploying' | 'done' | 'error';
}

// Active task state for async tool execution
interface ActiveTask {
  taskId: string;
  type: 'image' | 'video' | 'audio' | 'email' | 'other';
  description: string;
  startTime: number;
  status: 'running' | 'complete' | 'error';
}

interface Character {
  id: string;
  name: string;
  fullName?: string;
  title?: string;
  avatar: string;
}

const CHARACTERS: Character[] = [
  {
    id: "kagan",
    name: "Kagan",
    fullName: "Kagan Sumer",
    title: "Entrepreneur, founder Gorillas",
    avatar: "/kagan-avatar.jpg",
  },
  {
    id: "joko",
    name: "Joko",
    fullName: "Joko",
    title: "TV host",
    avatar: "/joko-avatar.mov",
  },
  {
    id: "steve-jobs",
    name: "Steve Jobs",
    avatar: "/steve-jobs-frame.jpg",
  },
  {
    id: "marc-andreessen",
    name: "Marc Andreessen",
    avatar: "/marc-avatar.jpg",
  },
  {
    id: "elon-musk",
    name: "Elon Musk",
    avatar: "/elon-avatar.jpg",
  },
  {
    id: "alexandra-cooper",
    name: "Alexandra Cooper",
    fullName: "Alexandra Cooper",
    title: "Host, Call Her Daddy",
    avatar: "/alexandra-cooper-avatar.jpg",
  },
];

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const characterId = params.id as string;

  const character = CHARACTERS.find((c) => c.id === characterId) || CHARACTERS[0];

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [pinnedAction, setPinnedAction] = useState<string | null>(null);
  const [sessionMetadata, setSessionMetadata] = useState<SessionMetadata | null>(null);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [activeBuild, setActiveBuild] = useState<ActiveBuild | null>(null);
  const [activeTask, setActiveTask] = useState<ActiveTask | null>(null);
  const [attachedImage, setAttachedImage] = useState<{ url: string; preview: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockModalReason, setUnlockModalReason] = useState<'agent' | 'oauth'>('agent');
  const [pendingAgentId, setPendingAgentId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Auth state
  const { user, isLoggedIn, loading: authLoading } = useAuth();

  // Extract ONE THING from message and return cleaned content
  const extractOneThing = useCallback((content: string): { cleanContent: string; oneThing: string | null } => {
    // Match "📌 ONE THING: [action]" pattern (with or without emoji)
    const patterns = [
      /📌\s*ONE THING:\s*(.+?)(?:\n|$)/i,
      /ONE THING:\s*(.+?)(?:\n|$)/i,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const oneThing = match[1].trim();
        console.log('[ONE THING] MATCH FOUND:', oneThing);
        const cleanContent = content.replace(match[0], '').trim();
        return { cleanContent, oneThing };
      }
    }

    return { cleanContent: content, oneThing: null };
  }, []);

  // Strip URLs from build messages (the deployed URL will be shown as a card)
  const stripUrlsFromBuildMessage = useCallback((content: string): string => {
    // Remove Vercel URLs and common link patterns
    return content
      .replace(/https?:\/\/[^\s]+\.vercel\.app[^\s]*/gi, '')
      .replace(/here'?s?\s*(the\s*)?(link|url|demo)[:\s]*/gi, '')
      .replace(/check\s*it\s*out\s*(at)?[:\s]*/gi, '')
      .replace(/\n{3,}/g, '\n\n') // Clean up extra newlines
      .trim();
  }, []);

  // Initialize user ID and session metadata
  useEffect(() => {
    // Wait for auth to finish loading before determining userId
    if (typeof window !== "undefined" && !sessionInitialized && !authLoading) {
      // Prefer Supabase user ID if logged in, otherwise use anonymous localStorage ID
      let effectiveUserId: string;
      if (isLoggedIn && user) {
        effectiveUserId = user.id;
        console.log('[SESSION] Using Supabase userId:', effectiveUserId);
      } else {
        let storedUserId = localStorage.getItem("nutz-user-id");
        if (!storedUserId) {
          storedUserId = `anon-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          localStorage.setItem("nutz-user-id", storedUserId);
        }
        effectiveUserId = storedUserId;
        console.log('[SESSION] Using anonymous userId:', effectiveUserId);
      }
      setUserId(effectiveUserId);

      // Get session metadata (contains lastOneThing, sessionCount, etc.)
      const metadata = getSessionMetadata(effectiveUserId);
      setSessionMetadata(metadata);

      // Load last ONE THING if exists
      if (metadata?.lastOneThing) {
        setPinnedAction(metadata.lastOneThing);
        console.log('[SESSION] Loaded lastOneThing:', metadata.lastOneThing);
      }

      // Increment session count for new session
      const newCount = incrementSessionCount(effectiveUserId);
      console.log('[SESSION] Session count:', newCount);

      // Update local metadata with new count
      setSessionMetadata(prev => prev ? { ...prev, sessionCount: newCount } : {
        lastSessionTimestamp: Date.now(),
        lastSessionThreadId: '',
        recentThreadIds: [],
        lastOneThing: null,
        lastOneThingDate: null,
        sessionCount: newCount,
      });

      setSessionInitialized(true);
    }
  }, [sessionInitialized, authLoading, isLoggedIn, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if ((!input.trim() && !attachedImage) || isLoading || !userId) return;

    const userMessage = input.trim();
    const imageToSend = attachedImage;

    setInput("");
    setAttachedImage(null);

    // Show user message with attached image preview
    setMessages((prev) => [...prev, {
      role: "user",
      content: userMessage,
      imageUrl: imageToSend?.preview || null,
    }]);
    setIsLoading(true);

    try {
      // Include image URL in message if attached
      const messageWithImage = imageToSend
        ? `${userMessage}\n\n[Attached image: ${imageToSend.url}]`
        : userMessage;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageWithImage,
          threadId,
          userId,
          characterId,
          // Send session metadata to server for context building
          sessionMetadata: sessionMetadata ? {
            lastSessionTimestamp: sessionMetadata.lastSessionTimestamp,
            lastOneThing: sessionMetadata.lastOneThing,
            lastOneThingDate: sessionMetadata.lastOneThingDate,
            sessionCount: sessionMetadata.sessionCount,
          } : null,
          // Also send image URL separately for tools
          attachedImageUrl: imageToSend?.url || null,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Update thread ID
      setThreadId(data.threadId);

      // Extract ONE THING from response (local extraction as backup)
      const { cleanContent, oneThing: localOneThing } = extractOneThing(data.response);

      // Use server-extracted ONE THING if available, else use local extraction
      const oneThing = data.oneThing || localOneThing;

      if (oneThing) {
        setPinnedAction(oneThing);
        console.log('[ONE THING] Set new action:', oneThing);
      }

      // Update session metadata in localStorage after each message
      updateSessionAfterMessage(userId, data.threadId, oneThing);

      // Update local state with new metadata
      setSessionMetadata(prev => prev ? {
        ...prev,
        lastSessionTimestamp: Date.now(),
        lastSessionThreadId: data.threadId,
        lastOneThing: oneThing || prev.lastOneThing,
        lastOneThingDate: oneThing ? new Date().toISOString() : prev.lastOneThingDate,
      } : null);

      const newMessageIndex = messages.length + 1; // +1 for user message we just added
      // If this is a build message, strip URLs from content (they'll show as cards)
      const finalContent = data.buildId ? stripUrlsFromBuildMessage(cleanContent) : cleanContent;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: finalContent,
          artifact: data.artifact,
          gifUrl: data.gifUrl,
          imageUrl: data.imageUrl,
          isBuilding: data.isBuilding,
          buildId: data.buildId,
          taskId: data.taskId,
        },
      ]);

      // If building, start polling for result
      if (data.buildId) {
        pollBuildStatus(data.buildId, newMessageIndex);
      }

      // If async task started, start polling for result
      if (data.taskId) {
        pollTaskStatus(data.taskId, data.taskType || 'other', data.response || 'working...');
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for build status - uses buildId to find the correct message
  // Uses setInterval for more reliable polling in PWAs (setTimeout can be throttled in background)
  const pollBuildStatus = (buildId: string, _messageIndex: number) => {
    const maxAttempts = 90; // 90 attempts * 2 seconds = 3 minutes max
    let attempts = 0;
    let intervalId: NodeJS.Timeout | null = null;
    const startTime = Date.now();

    console.log('[BUILD] Starting poll for buildId:', buildId);

    // Set active build banner
    setActiveBuild({ buildId, startTime, stage: 'generating' });

    const poll = async () => {
      attempts++;
      const elapsed = Date.now() - startTime;
      console.log('[BUILD] Poll attempt', attempts, 'for buildId:', buildId, 'elapsed:', elapsed);

      // Update stage based on time (rough estimate)
      if (elapsed > 15000 && elapsed < 45000) {
        setActiveBuild(prev => prev?.buildId === buildId ? { ...prev, stage: 'deploying' } : prev);
      }

      try {
        const res = await fetch(`/api/build-status?buildId=${buildId}`);
        console.log('[BUILD] Response status:', res.status);

        if (!res.ok) {
          console.error('[BUILD] Response not OK:', res.status, res.statusText);
          if (attempts >= maxAttempts && intervalId) {
            clearInterval(intervalId);
            setActiveBuild(null);
          }
          return;
        }

        const data = await res.json();
        console.log('[BUILD] Poll response:', JSON.stringify(data));

        if (data.status === 'complete') {
          console.log('[BUILD] ✅ Complete! URL:', data.deployedUrl, 'Doc:', data.document?.title);
          if (intervalId) clearInterval(intervalId);
          // Show done briefly then clear
          setActiveBuild(prev => prev?.buildId === buildId ? { ...prev, stage: 'done' } : prev);
          setTimeout(() => setActiveBuild(null), 2000);
          // Update the message that has this buildId
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg.buildId === buildId
                ? {
                    ...msg,
                    isBuilding: false,
                    deployedUrl: data.deployedUrl,
                    agentDocument: data.document,
                  }
                : msg
            );
            console.log('[BUILD] Updated messages count:', updated.length);
            return updated;
          });
          return;
        }

        if (data.status === 'error') {
          console.error('[BUILD] ❌ Failed:', data.error);
          if (intervalId) clearInterval(intervalId);
          setActiveBuild(prev => prev?.buildId === buildId ? { ...prev, stage: 'error' } : prev);
          setTimeout(() => setActiveBuild(null), 3000);
          setMessages((prev) => prev.map((msg) =>
            msg.buildId === buildId ? { ...msg, isBuilding: false } : msg
          ));
          return;
        }

        // Still building
        console.log('[BUILD] Still building, elapsed:', data.elapsed, 'ms');
        if (attempts >= maxAttempts) {
          console.error('[BUILD] ⏰ Timeout after', maxAttempts, 'attempts');
          if (intervalId) clearInterval(intervalId);
          setActiveBuild(null);
          setMessages((prev) => prev.map((msg) =>
            msg.buildId === buildId ? { ...msg, isBuilding: false } : msg
          ));
        }
      } catch (err) {
        console.error('[BUILD] Poll error:', err);
        if (attempts >= maxAttempts && intervalId) {
          clearInterval(intervalId);
          setActiveBuild(null);
        }
      }
    };

    // Start polling with setInterval (more reliable than setTimeout chain in PWAs)
    setTimeout(() => {
      poll(); // First poll immediately
      intervalId = setInterval(poll, 2000); // Then every 2 seconds
    }, 1000);
  };

  // Poll for async task status (image/video/audio generation)
  const pollTaskStatus = (taskId: string, taskType: string, description: string) => {
    const maxAttempts = 120; // 120 attempts * 2 seconds = 4 minutes max
    let attempts = 0;
    let intervalId: NodeJS.Timeout | null = null;
    const startTime = Date.now();

    console.log('[TASK] Starting poll for taskId:', taskId, 'type:', taskType);

    // Set active task banner
    setActiveTask({
      taskId,
      type: taskType as ActiveTask['type'],
      description,
      startTime,
      status: 'running',
    });

    const poll = async () => {
      attempts++;
      const elapsed = Date.now() - startTime;
      console.log('[TASK] Poll attempt', attempts, 'for taskId:', taskId, 'elapsed:', elapsed);

      try {
        const res = await fetch(`/api/task-status?taskId=${taskId}`);
        console.log('[TASK] Response status:', res.status);

        if (!res.ok) {
          console.error('[TASK] Response not OK:', res.status, res.statusText);
          if (attempts >= maxAttempts && intervalId) {
            clearInterval(intervalId);
            setActiveTask(null);
          }
          return;
        }

        const data = await res.json();
        console.log('[TASK] Poll response:', JSON.stringify(data));

        if (data.status === 'complete') {
          console.log('[TASK] Complete! Result:', data.result);
          if (intervalId) clearInterval(intervalId);

          // Update banner briefly then clear
          setActiveTask(prev => prev?.taskId === taskId ? { ...prev, status: 'complete' } : prev);
          setTimeout(() => setActiveTask(null), 2000);

          // Update the message that has this taskId with the result
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg.taskId === taskId
                ? {
                    ...msg,
                    // Update content if agent returned text (for email confirmations, etc.)
                    content: data.result?.text || msg.content,
                    imageUrl: data.result?.imageUrl || msg.imageUrl,
                    videoUrl: data.result?.videoUrl || msg.videoUrl,
                    audioUrl: data.result?.audioUrl || msg.audioUrl,
                  }
                : msg
            );
            console.log('[TASK] Updated messages with result');
            return updated;
          });
          return;
        }

        if (data.status === 'error') {
          console.error('[TASK] Failed:', data.error);
          if (intervalId) clearInterval(intervalId);
          setActiveTask(prev => prev?.taskId === taskId ? { ...prev, status: 'error' } : prev);
          setTimeout(() => setActiveTask(null), 3000);
          return;
        }

        // Still running
        console.log('[TASK] Still running, elapsed:', data.elapsed, 'ms');
        if (attempts >= maxAttempts) {
          console.error('[TASK] Timeout after', maxAttempts, 'attempts');
          if (intervalId) clearInterval(intervalId);
          setActiveTask(null);
        }
      } catch (err) {
        console.error('[TASK] Poll error:', err);
        if (attempts >= maxAttempts && intervalId) {
          clearInterval(intervalId);
          setActiveTask(null);
        }
      }
    };

    // Start polling
    setTimeout(() => {
      poll();
      intervalId = setInterval(poll, 2000);
    }, 1000);
  };

  // Handle clearing ONE THING (e.g., when user completes it)
  const handleClearOneThing = () => {
    setPinnedAction(null);
    if (userId) {
      // Clear from localStorage too
      const metadata = getSessionMetadata(userId);
      if (metadata) {
        updateSessionAfterMessage(userId, threadId || '', null);
        // Force clear the ONE THING
        const updated = { ...metadata, lastOneThing: null, lastOneThingDate: null };
        localStorage.setItem(`session_${userId}`, JSON.stringify(updated));
      }
    }
  };

  // Handle image upload with timeout and retry
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear any previous error
    setUploadError(null);

    // Create preview
    const preview = URL.createObjectURL(file);
    setIsUploading(true);

    const uploadWithTimeout = async (attempt: number = 1): Promise<string> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      try {
        const formData = new FormData();
        formData.append('file', file);

        console.log(`[UPLOAD] Attempt ${attempt}, file size: ${(file.size / 1024).toFixed(1)}KB`);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Upload failed (${res.status})`);
        }

        const data = await res.json();
        if (!data.url) {
          throw new Error('No URL returned from upload');
        }

        return data.url;
      } catch (err) {
        clearTimeout(timeoutId);

        // Retry once on timeout or network error
        if (attempt < 2 && (err instanceof Error && (err.name === 'AbortError' || err.message.includes('network')))) {
          console.log(`[UPLOAD] Retrying after error:`, err);
          return uploadWithTimeout(attempt + 1);
        }

        throw err;
      }
    };

    try {
      const url = await uploadWithTimeout();
      setAttachedImage({ url, preview });
      console.log('[UPLOAD] Image attached:', url);
    } catch (err) {
      console.error('[UPLOAD] Error:', err);
      URL.revokeObjectURL(preview);
      const errorMessage = err instanceof Error
        ? (err.name === 'AbortError' ? 'Upload timed out' : err.message)
        : 'Upload failed';
      setUploadError(errorMessage);
      // Clear error after 5 seconds
      setTimeout(() => setUploadError(null), 5000);
    } finally {
      setIsUploading(false);
      // Reset input so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Clear attached image
  const clearAttachedImage = () => {
    if (attachedImage?.preview) {
      URL.revokeObjectURL(attachedImage.preview);
    }
    setAttachedImage(null);
  };

  // Voice input toggle
  const toggleVoiceInput = () => {
    if (isRecording) {
      // Stop recording
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      // Start recording
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionAPI) {
        alert("Voice input not supported in this browser");
        return;
      }

      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput(transcript);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    }
  };

  // Trigger unlock modal for agent switch (called when user wants to switch to another agent)
  const handleAgentSwitch = (targetAgentId: string) => {
    if (!isLoggedIn) {
      // Show unlock modal
      setUnlockModalReason('agent');
      setPendingAgentId(targetAgentId);
      setShowUnlockModal(true);
    } else {
      // Already logged in, navigate directly
      router.push(`/room/${targetAgentId}`);
    }
  };

  // Trigger unlock modal for OAuth tools (called when user tries to use Gmail, Calendar, etc.)
  const handleOAuthRequired = (appName: string) => {
    if (!isLoggedIn) {
      setUnlockModalReason('oauth');
      setShowUnlockModal(true);
    } else {
      // Already logged in, proceed with OAuth flow
      router.push('/settings/connections');
    }
  };

  return (
    <div className="h-[100dvh] text-white flex flex-col fixed inset-0 overflow-hidden">
      {/* Gradient Background - iOS 26 style */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-300 via-purple-300 to-orange-200" />
      <div className="absolute inset-0 bg-gradient-to-t from-orange-300/50 via-transparent to-pink-400/30" />

      {/* Back button - top left */}
      <button
        onClick={() => router.push(`/room/${characterId}`)}
        className="!absolute left-4 z-30 w-10 h-10 rounded-full liquid-glass flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Settings button - top right */}
      <button
        onClick={() => router.push('/settings/connections')}
        className="!absolute right-4 z-30 w-10 h-10 rounded-full liquid-glass flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        title="Connected Apps"
      >
        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Centered Agent Avatar */}
      <div
        className="!absolute left-1/2 -translate-x-1/2 z-30 flex flex-col items-center"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <div className="w-16 h-16 rounded-full overflow-hidden liquid-glass p-0.5">
          {character.avatar.endsWith('.mov') || character.avatar.endsWith('.mp4') ? (
            <video
              src={character.avatar}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <Image
              src={character.avatar}
              alt={character.name}
              width={64}
              height={64}
              className="w-full h-full object-cover rounded-full"
            />
          )}
        </div>
        <span className="mt-1 text-sm font-medium text-gray-700/80">{character.name}</span>
      </div>

      {/* Session indicator (dev only) */}
      {sessionMetadata && process.env.NODE_ENV === 'development' && (
        <div
          className="absolute right-16 z-30 text-xs text-gray-600/50"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
        >
          S#{sessionMetadata.sessionCount}
        </div>
      )}

      {/* Floating Banners Container - positioned below avatar */}
      <div className="absolute top-24 left-4 right-4 z-20 space-y-2">
        {/* Pinned Build Progress Banner */}
        {activeBuild && (
          <div className="liquid-glass rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className={`text-lg ${activeBuild.stage !== 'done' && activeBuild.stage !== 'error' ? 'animate-pulse' : ''}`}>
              {activeBuild.stage === 'error' ? '💀' : ''}
            </span>
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-medium ${
                activeBuild.stage === 'done' ? 'text-green-700' :
                activeBuild.stage === 'error' ? 'text-red-700' :
                'text-blue-700'
              }`}>
                {activeBuild.stage === 'generating' ? 'u fckn nutz!?' :
                 activeBuild.stage === 'deploying' ? 'vercel!!' :
                 activeBuild.stage === 'done' ? 'LFG' : 'rip'}
              </span>
              <p className="text-xs text-gray-600">
                {activeBuild.stage === 'generating' ? 'generating the bb' :
                 activeBuild.stage === 'deploying' ? 'almost there...' :
                 activeBuild.stage === 'done' ? 'link ready below' : 'something broke'}
              </p>
            </div>
            {activeBuild.stage !== 'done' && activeBuild.stage !== 'error' && (
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>
        )}

        {/* Pinned Task Progress Banner */}
        {activeTask && !activeBuild && (
          <div className="liquid-glass rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className={`text-lg ${activeTask.status === 'running' ? 'animate-pulse' : ''}`}>
              {activeTask.status === 'error' ? '💀' :
               activeTask.type === 'image' ? '🎨' :
               activeTask.type === 'video' ? '🎬' :
               activeTask.type === 'audio' ? '🎵' :
               activeTask.type === 'email' ? '📧' : '⚙️'}
            </span>
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-medium ${
                activeTask.status === 'complete' ? 'text-green-700' :
                activeTask.status === 'error' ? 'text-red-700' :
                'text-purple-700'
              }`}>
                {activeTask.status === 'complete' ? 'done!' :
                 activeTask.status === 'error' ? 'rip' :
                 activeTask.description}
              </span>
              <p className="text-xs text-gray-600">
                {activeTask.status === 'complete' ? 'check it out below' :
                 activeTask.status === 'error' ? 'something broke' :
                 'u can keep chatting'}
              </p>
            </div>
            {activeTask.status === 'running' && (
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>
        )}

        {/* Pinned ONE THING Banner */}
        {pinnedAction && !activeBuild && !activeTask && (
          <div className="liquid-glass-warm rounded-2xl px-4 py-3 flex items-center gap-2">
            <span className="text-lg">📌</span>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-amber-800 uppercase tracking-wide font-medium">ONE THING</span>
              <p className="text-sm text-gray-700 truncate">{pinnedAction}</p>
            </div>
            <button
              onClick={handleClearOneThing}
              className="text-gray-500 hover:text-gray-700 transition-colors p-1"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Top fade gradient - content fades as it scrolls under header */}
      <div className="absolute top-0 left-0 right-0 h-28 z-15 pointer-events-none bg-gradient-to-b from-pink-300 via-pink-300/80 to-transparent" />

      {/* Messages */}
      <main className="relative z-10 flex-1 overflow-y-auto pt-28 pb-24 px-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-600/70 mt-16">
            <p className="text-lg mb-2">Start a conversation</p>
            <p className="text-sm">Ask anything about startups, building products, or getting advice.</p>
          </div>
        )}

        {messages.map((message, i) => (
          <div
            key={i}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className="max-w-[80%]">
              {/* Split assistant messages into multiple bubbles on double newline */}
              {message.role === "assistant" ? (
                message.content && message.content.trim() && (
                  <div className="space-y-2">
                    {message.content.split(/\n\n+/).filter(part => part.trim()).map((part, partIndex) => (
                      <div
                        key={partIndex}
                        className="rounded-3xl px-4 py-3 liquid-glass text-gray-800"
                      >
                        <p className="whitespace-pre-wrap text-sm">{part.trim()}</p>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* User messages - show image and/or text */
                (message.content?.trim() || message.imageUrl) && (
                  <div className="space-y-2">
                    {message.imageUrl && (
                      <div className="rounded-2xl overflow-hidden max-w-[200px] liquid-glass p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={message.imageUrl}
                          alt="Attached"
                          className="w-full h-auto rounded-xl"
                        />
                      </div>
                    )}
                    {message.content?.trim() && (
                      <div className="rounded-3xl px-4 py-3 liquid-glass-warm text-gray-800">
                        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      </div>
                    )}
                  </div>
                )
              )}
              {message.gifUrl && (
                <div className="mt-2 rounded-2xl overflow-hidden max-w-[280px] liquid-glass p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={message.gifUrl}
                    alt="GIF"
                    className="w-full h-auto rounded-xl"
                  />
                </div>
              )}
              {message.role === "assistant" && message.imageUrl && (
                <div className="mt-2 rounded-2xl overflow-hidden max-w-[320px] liquid-glass p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={message.imageUrl}
                    alt="Generated image"
                    className="w-full h-auto rounded-xl"
                  />
                </div>
              )}
              {message.videoUrl && (
                <div className="mt-2 rounded-2xl overflow-hidden max-w-[320px] liquid-glass p-1">
                  <video
                    src={message.videoUrl}
                    controls
                    className="w-full h-auto rounded-xl"
                    playsInline
                  />
                </div>
              )}
              {message.audioUrl && (
                <div className="mt-2 rounded-2xl overflow-hidden max-w-[320px] liquid-glass p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-purple-600">🎵</span>
                    <span className="text-sm text-gray-700">Generated audio</span>
                  </div>
                  <audio
                    src={message.audioUrl}
                    controls
                    className="w-full"
                  />
                </div>
              )}
              {message.artifact && <ArtifactCard artifact={message.artifact} />}

              {/* Deployed URL from agent */}
              {message.deployedUrl && (
                <a
                  href={message.deployedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${message.content?.trim() ? 'mt-2' : ''} block liquid-glass rounded-2xl p-4 hover:scale-[1.02] transition-transform`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>🚀</span>
                    <span className="text-green-700 font-medium text-sm">Live Demo</span>
                  </div>
                  <p className="text-gray-700 text-sm truncate">{message.deployedUrl}</p>
                  <p className="text-green-600/70 text-xs mt-1">Tap to open</p>
                </a>
              )}

              {/* Document from agent */}
              {message.agentDocument && (
                <div className={`${message.content?.trim() ? 'mt-2' : ''} liquid-glass rounded-2xl p-4`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span>📄</span>
                    <span className="text-blue-700 font-medium text-sm">{message.agentDocument.title}</span>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    <pre className="text-gray-700 text-sm whitespace-pre-wrap font-sans">
                      {message.agentDocument.content}
                    </pre>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(message.agentDocument!.content);
                    }}
                    className="mt-2 text-blue-600/70 text-xs hover:text-blue-700 transition-colors"
                  >
                    Copy to clipboard
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="liquid-glass rounded-3xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-500/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-500/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-500/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Glassmorphic Input - Fixed above bottom */}
      <footer className="absolute bottom-6 left-4 right-4 z-20 safe-area-bottom">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        {/* Attached image preview - floating above input */}
        {attachedImage && (
          <div className="mb-3 relative inline-block">
            <div className="liquid-glass rounded-2xl p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachedImage.preview}
                alt="Attached"
                className="h-20 w-auto rounded-xl object-cover"
              />
            </div>
            <button
              onClick={clearAttachedImage}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500/80 backdrop-blur-sm rounded-full flex items-center justify-center text-white text-xs border border-red-400/50"
            >
              ✕
            </button>
          </div>
        )}

        {/* Upload progress */}
        {isUploading && (
          <div className="mb-3 text-sm text-gray-600 flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-gray-400/50 border-t-gray-600 rounded-full animate-spin" />
            uploading...
          </div>
        )}

        {/* Upload error */}
        {uploadError && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mb-3 liquid-glass rounded-xl px-3 py-2 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            <span className="text-red-500">upload failed</span>
            <span className="text-xs text-gray-500">tap to try again</span>
          </button>
        )}

        {/* Input row with + button outside */}
        <div className="flex items-center gap-2">
          {/* Plus button - OUTSIDE the message bar */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isUploading}
            className="w-10 h-10 rounded-full liquid-glass disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center flex-shrink-0 hover:scale-105 active:scale-95"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {/* Liquid glass input bar */}
          <div className="flex-1 liquid-glass rounded-full flex items-center gap-1 px-4 py-2">
            {/* Text input */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="iMessage"
              className="flex-1 bg-transparent py-1 text-gray-800 placeholder:text-gray-500/70 focus:outline-none text-sm"
            />

            {/* Mic/Send button - inside the bar on right */}
            <button
              onClick={input.trim() || attachedImage ? sendMessage : toggleVoiceInput}
              disabled={isLoading}
              className={`w-8 h-8 rounded-full transition-all flex items-center justify-center flex-shrink-0 ${
                isRecording
                  ? "bg-red-500 animate-pulse"
                  : input.trim() || attachedImage
                  ? "bg-blue-500 hover:bg-blue-600"
                  : "hover:bg-white/30"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {input.trim() || attachedImage ? (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              ) : (
                <svg className={`w-5 h-5 ${isRecording ? 'text-white' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* Unlock Agents Modal - triggered on referral or OAuth */}
      <UnlockAgentsModal
        isOpen={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        reason={unlockModalReason}
        targetAgentId={pendingAgentId}
      />
    </div>
  );
}
