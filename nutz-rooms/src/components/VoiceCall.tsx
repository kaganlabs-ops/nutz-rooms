"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Conversation } from "@elevenlabs/client";

type CallStatus = "idle" | "connecting" | "connected" | "speaking" | "listening";

interface VoiceCallProps {
  agentId: string;
  characterName: string;
  onClose: () => void;
}

export default function VoiceCall({ agentId, characterName, onClose }: VoiceCallProps) {
  const [status, setStatus] = useState<CallStatus>("connecting");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const hasStarted = useRef(false);

  const startCall = useCallback(async () => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    try {
      setStatus("connecting");
      setError(null);

      // Fetch Zep context for the voice call
      let zepContext = "";
      try {
        const contextRes = await fetch("/api/voice-context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: `Who is ${characterName}? What should I know about them?` }),
        });
        const contextData = await contextRes.json();
        zepContext = contextData.context || "";
        console.log("Fetched Zep context:", zepContext.slice(0, 200));
      } catch (e) {
        console.error("Failed to fetch Zep context:", e);
      }

      // Request microphone access
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const conv = await Conversation.startSession({
        agentId,
        connectionType: "websocket",
        dynamicVariables: {
          zep_context: zepContext || "No additional context available.",
        },
        onConnect: () => {
          console.log("Connected to ElevenLabs");
          setStatus("connected");
        },
        onDisconnect: () => {
          console.log("Disconnected from ElevenLabs");
          setStatus("idle");
          setConversation(null);
        },
        onMessage: (message) => {
          console.log("Message:", message);
          if (message.message) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const source = (message as any).source || (message as any).source_type;
            setTranscript((prev) => [
              ...prev,
              {
                role: source === "user" ? "user" : "assistant",
                text: message.message,
              },
            ]);
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
          console.error("ElevenLabs error:", err);
          setError("Connection error. Please try again.");
          setStatus("idle");
        },
      });

      setConversation(conv);
    } catch (err) {
      console.error("Failed to start call:", err);
      setError("Failed to access microphone. Please allow microphone access.");
      setStatus("idle");
    }
  }, [agentId]);

  // Auto-start call when component mounts
  useEffect(() => {
    startCall();
  }, [startCall]);

  const endCall = useCallback(async () => {
    if (conversation) {
      await conversation.endSession();
      setConversation(null);
    }
    setStatus("idle");
  }, [conversation]);

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
        return "Ready to call";
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
        <div className="text-white font-medium">Voice Call with {characterName}</div>
        <div className="w-10" />
      </div>

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
