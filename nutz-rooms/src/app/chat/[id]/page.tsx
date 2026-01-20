"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import ArtifactCard from "@/components/ArtifactCard";
import type { Artifact } from "@/lib/artifacts";

interface Message {
  role: "user" | "assistant";
  content: string;
  artifact?: Artifact | null;
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
  const userId = "kagan-sumer";
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

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
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setThreadId(data.threadId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response, artifact: data.artifact },
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
      </header>

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
