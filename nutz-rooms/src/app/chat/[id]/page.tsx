"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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

interface Message {
  role: "user" | "assistant";
  content: string;
  artifact?: Artifact | null;
  gifUrl?: string | null;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Initialize user ID and session metadata from localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && !sessionInitialized) {
      // Get or create user ID
      let storedUserId = localStorage.getItem("nutz-user-id");
      if (!storedUserId) {
        storedUserId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem("nutz-user-id", storedUserId);
      }
      setUserId(storedUserId);

      // Get session metadata (contains lastOneThing, sessionCount, etc.)
      const metadata = getSessionMetadata(storedUserId);
      setSessionMetadata(metadata);

      // Load last ONE THING if exists
      if (metadata?.lastOneThing) {
        setPinnedAction(metadata.lastOneThing);
        console.log('[SESSION] Loaded lastOneThing:', metadata.lastOneThing);
      }

      // Increment session count for new session
      const newCount = incrementSessionCount(storedUserId);
      console.log('[SESSION] Session count:', newCount);

      // Update local metadata with new count
      setSessionMetadata(prev => prev ? { ...prev, sessionCount: newCount } : {
        lastSessionTimestamp: Date.now(),
        lastSessionThreadId: '',
        lastOneThing: null,
        lastOneThingDate: null,
        sessionCount: newCount,
      });

      setSessionInitialized(true);
    }
  }, [sessionInitialized]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !userId) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
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

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: cleanContent, artifact: data.artifact, gifUrl: data.gifUrl },
      ]);
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

  return (
    <div className="h-[100dvh] bg-black text-white flex flex-col fixed inset-0">
      {/* Header */}
      <header className="border-b border-white/10 p-4 flex items-center gap-3">
        <button
          onClick={() => router.push(`/room/${characterId}`)}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-10 h-10 rounded-full overflow-hidden">
          <Image
            src={character.avatar}
            alt={character.name}
            width={40}
            height={40}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1">
          <h1 className="font-semibold">{character.fullName || character.name}</h1>
          {character.title && (
            <p className="text-xs text-white/50">{character.title}</p>
          )}
        </div>
        {/* Session indicator (dev only) */}
        {sessionMetadata && process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-white/30">
            S#{sessionMetadata.sessionCount}
          </div>
        )}
      </header>

      {/* Pinned ONE THING Banner */}
      {pinnedAction && (
        <div className="bg-gradient-to-r from-amber-900/40 to-orange-900/40 border-b border-amber-500/30 px-4 py-3 flex items-center gap-2">
          <span className="text-lg">📌</span>
          <div className="flex-1 min-w-0">
            <span className="text-xs text-amber-400/70 uppercase tracking-wide font-medium">ONE THING</span>
            <p className="text-sm text-white/90 truncate">{pinnedAction}</p>
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

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-white/40 mt-10">
            <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-4">
              <Image
                src={character.avatar}
                alt={character.name}
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-lg mb-2">Start a conversation with {character.name}</p>
            <p className="text-sm">Ask anything about startups, building products, or getting advice.</p>
          </div>
        )}

        {messages.map((message, i) => (
          <div
            key={i}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.role === "assistant" && (
              <div className="w-8 h-8 rounded-full overflow-hidden mr-2 flex-shrink-0">
                <Image
                  src={character.avatar}
                  alt={character.name}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="max-w-[75%]">
              <div
                className={`rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white/10 text-white"
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>
              </div>
              {message.gifUrl && (
                <div className="mt-2 rounded-xl overflow-hidden max-w-[280px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={message.gifUrl}
                    alt="GIF"
                    className="w-full h-auto"
                  />
                </div>
              )}
              {message.artifact && <ArtifactCard artifact={message.artifact} />}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full overflow-hidden mr-2 flex-shrink-0">
              <Image
                src={character.avatar}
                alt={character.name}
                width={32}
                height={32}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="bg-white/10 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <footer className="border-t border-white/10 p-4 safe-area-bottom">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder={`Message ${character.name}...`}
            className="flex-1 bg-white/10 rounded-full px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </footer>
    </div>
  );
}
