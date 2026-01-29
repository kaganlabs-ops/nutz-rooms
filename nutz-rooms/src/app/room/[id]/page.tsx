"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import VoiceCall from "@/components/VoiceCall";
import { HomeScreen } from "@/components/HomeScreen";
import { OnboardingModal } from "@/components/OnboardingModal";

type VideoState = "idle" | "listening" | "speaking";

interface Character {
  id: string;
  name: string;
  fullName?: string;
  title?: string;
  avatar: string;
  phone?: string;
  interests?: string[];
  tools?: string[];
  helpTopics?: { title: string; description: string }[];
  agentId?: string;
  videoSources: {
    idle: string;
    listening: string;
    speaking: string;
  };
}

const CHARACTERS: Character[] = [
  {
    id: "kagan",
    name: "Kagan",
    fullName: "Kagan Sumer",
    title: "Entrepreneur, founder Gorillas",
    avatar: "/kagan-avatar.jpg",
    phone: "4917665845156",
    interests: ["AI", "Cyberpunk", "Groceries", "Brands", "Fundraising"],
    tools: ["Claude", "ElevenLabs", "FAL", "Next.js"],
    helpTopics: [
      { title: "Get first customers", description: "Customer acquisition" },
      { title: "Build a demo", description: "Product development" },
      { title: "Craft your pitch", description: "Pitch deck creation" },
      { title: "Investor outreach", description: "Fundraising strategy" },
    ],
    agentId: "agent_1001kefsejbwfs38hagtrp87e3zw",
    videoSources: {
      idle: "/kagan.mp4",
      listening: "/kagan.mp4",
      speaking: "/kagan.mp4",
    },
  },
  {
    id: "mike",
    name: "Mike",
    fullName: "Mike",
    title: "Fitness Coach, former D1 athlete",
    avatar: "/mike-avatar.jpg",
    interests: ["Strength Training", "Nutrition", "Recovery", "Form"],
    helpTopics: [
      { title: "Build a workout", description: "Training programming" },
      { title: "Fix my form", description: "Injury prevention" },
      { title: "Get stronger", description: "Progressive overload" },
      { title: "Eat better", description: "Nutrition basics" },
    ],
    videoSources: {
      idle: "/kagan.mp4",
      listening: "/kagan.mp4",
      speaking: "/kagan.mp4",
    },
  },
  {
    id: "sarah",
    name: "Sarah",
    fullName: "Sarah",
    title: "Mindfulness Coach, ex-finance",
    avatar: "/sarah-avatar.jpg",
    interests: ["Meditation", "Stress", "Sleep", "Focus"],
    helpTopics: [
      { title: "Start meditating", description: "5 minute practice" },
      { title: "Sleep better", description: "Wind-down routine" },
      { title: "Handle stress", description: "Grounding techniques" },
      { title: "Improve focus", description: "Single-tasking" },
    ],
    videoSources: {
      idle: "/kagan.mp4",
      listening: "/kagan.mp4",
      speaking: "/kagan.mp4",
    },
  },
  {
    id: "joko",
    name: "Joko",
    fullName: "Joko",
    title: "TV host",
    avatar: "/joko-avatar.mov",
    videoSources: {
      idle: "/joko-avatar.mov",
      listening: "/joko-avatar.mov",
      speaking: "/joko-avatar.mov",
    },
  },
  {
    id: "steve-jobs",
    name: "Steve Jobs",
    avatar: "/steve-jobs-frame.jpg",
    videoSources: {
      idle: "/listening.mp4",
      listening: "/listening.mp4",
      speaking: "/speaking.mp4",
    },
  },
  {
    id: "marc-andreessen",
    name: "Marc Andreessen",
    avatar: "/marc-avatar.jpg",
    videoSources: {
      idle: "/marc-listening.mp4",
      listening: "/marc-listening.mp4",
      speaking: "/marc-listening.mp4",
    },
  },
  {
    id: "elon-musk",
    name: "Elon Musk",
    avatar: "/elon-avatar.jpg",
    videoSources: {
      idle: "/elon-listening.mp4",
      listening: "/elon-listening.mp4",
      speaking: "/elon-listening.mp4",
    },
  },
  {
    id: "alexandra-cooper",
    name: "Alexandra Cooper",
    fullName: "Alexandra Cooper",
    title: "Host, Call Her Daddy",
    avatar: "/alexandra-cooper-avatar.jpg",
    videoSources: {
      idle: "/alexandra-cooper.mp4",
      listening: "/alexandra-cooper.mp4",
      speaking: "/alexandra-cooper.mp4",
    },
  },
];

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [videoState] = useState<VideoState>("idle");
  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Long-press detection for NUTZ button
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);
  const LONG_PRESS_DURATION = 3000; // 3 seconds

  // Initialize or retrieve user ID from localStorage (same as chat page)
  useEffect(() => {
    if (typeof window !== "undefined") {
      let storedUserId = localStorage.getItem("nutz-user-id");
      if (!storedUserId) {
        storedUserId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem("nutz-user-id", storedUserId);
      }
      setUserId(storedUserId);
    }
  }, []);

  // Info panel expanded state
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);

  // Nutz button state - starts big in center on desktop
  const [nutzPosition, setNutzPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [nutzSize, setNutzSize] = useState(300);
  const [nutzInitialized, setNutzInitialized] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Initialize nutz position - load from localStorage or use defaults
  useEffect(() => {
    if (typeof window !== "undefined" && !nutzInitialized) {
      const saved = localStorage.getItem("nutz-position");
      if (saved) {
        try {
          const { x, y, size } = JSON.parse(saved);
          setNutzPosition({ x, y });
          setNutzSize(size);
        } catch {
          // Fall back to defaults if parse fails
          const isMobile = window.innerWidth < 768;
          if (isMobile) {
            setNutzPosition({ x: window.innerWidth - 60, y: 60 });
            setNutzSize(80);
          } else {
            setNutzPosition({ x: window.innerWidth / 2, y: 200 });
            setNutzSize(350);
          }
        }
      } else {
        // No saved position, use defaults
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
          setNutzPosition({ x: window.innerWidth - 60, y: 60 });
          setNutzSize(80);
        } else {
          setNutzPosition({ x: window.innerWidth / 2, y: 200 });
          setNutzSize(350);
        }
      }
      setNutzInitialized(true);
    }
  }, [nutzInitialized]);

  // Initialize character from URL
  useEffect(() => {
    const character = CHARACTERS.find(c => c.id === roomId);
    setSelectedCharacter(character || CHARACTERS[0]);
  }, [roomId]);

  // Update video source when state changes
  useEffect(() => {
    if (videoRef.current && selectedCharacter) {
      const newSrc = selectedCharacter.videoSources[videoState];
      if (!videoRef.current.src.endsWith(newSrc)) {
        videoRef.current.src = newSrc;
        videoRef.current.load();
        videoRef.current.play().catch(console.error);
      }
    }
  }, [videoState, selectedCharacter]);

  // Nutz button drag handlers
  const handleNutzMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - nutzPosition.x,
      y: e.clientY - nutzPosition.y,
    };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.current.x;
      setNutzPosition({
        x: newX,
        y: e.clientY - dragOffset.current.y,
      });
      // Grow as it moves left
      const windowWidth = window.innerWidth;
      const normalizedX = Math.max(0, Math.min(1, newX / windowWidth));
      const newSize = 400 - (normalizedX * 336);
      setNutzSize(Math.max(64, Math.min(400, newSize)));
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      // Save position to localStorage when drag ends
      localStorage.setItem("nutz-position", JSON.stringify({
        x: nutzPosition.x,
        y: nutzPosition.y,
        size: nutzSize,
      }));
    }
    setIsDragging(false);
  }, [isDragging, nutzPosition, nutzSize]);

  // Long-press handlers for NUTZ button - opens creator onboarding
  const handleNutzLongPressStart = useCallback(() => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setShowOnboarding(true);
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, LONG_PRESS_DURATION);
  }, []);

  const handleNutzLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Handle onboarding completion
  const handleOnboardingComplete = useCallback((config: { name: string }) => {
    console.log("[ONBOARDING] Created new agent:", config.name);
    // In the future: reload creators, navigate to new agent, etc.
  }, []);

  const handleSendMessage = () => {
    // Navigate to chat page for this character
    router.push(`/chat/${selectedCharacter?.id || "kagan"}`);
  };

  const handleCallClick = async () => {
    setMicError(null);

    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError("Your browser doesn't support microphone access");
      return;
    }

    try {
      // Request mic permission - this should show native browser popup
      console.log("Requesting mic permission...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Mic permission granted!", stream);
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      // Permission granted, now show voice call
      setShowVoiceCall(true);
    } catch (err) {
      console.error("Mic error:", err);
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          setMicError("Mic access denied. Check browser settings.");
        } else if (err.name === "NotFoundError") {
          setMicError("No microphone found on this device");
        } else {
          setMicError(`Mic error: ${err.name}`);
        }
      } else {
        setMicError("Could not access microphone");
      }
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!selectedCharacter) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-black relative overflow-hidden fixed inset-0">
      {/* Fullscreen Video */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        src={selectedCharacter.videoSources[videoState]}
      />

      {/* Bottom gradient */}
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

      {/* Left side - Character Info Panel */}
      <div className="absolute left-4 top-4 z-20">
        <div
          className={`bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden transition-all duration-300 ${
            isInfoExpanded ? "w-72" : "w-auto"
          }`}
        >
          {/* Collapsed: Name and Title header (clickable) */}
          <button
            onClick={() => setIsInfoExpanded(!isInfoExpanded)}
            className="w-full p-4 flex items-center gap-3 text-left hover:bg-white/5 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-white truncate">
                {selectedCharacter.fullName || selectedCharacter.name}
              </h2>
              {selectedCharacter.title && (
                <p className="text-white/60 text-sm truncate">{selectedCharacter.title}</p>
              )}
            </div>
            <svg
              className={`w-5 h-5 text-white/60 transition-transform ${isInfoExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Expanded content */}
          {isInfoExpanded && (
            <div className="px-4 pb-4 flex flex-col gap-4">
              {/* Interests */}
              {selectedCharacter.interests && selectedCharacter.interests.length > 0 && (
                <div>
                  <h3 className="text-white/40 text-xs uppercase tracking-wider mb-2">Interests</h3>
                  <p className="text-white/80 text-sm">
                    {selectedCharacter.interests.join(" • ")}
                  </p>
                </div>
              )}

              {/* Tools */}
              {selectedCharacter.tools && selectedCharacter.tools.length > 0 && (
                <div>
                  <h3 className="text-white/40 text-xs uppercase tracking-wider mb-2">Tools</h3>
                  <p className="text-white/80 text-sm">
                    {selectedCharacter.tools.join(" • ")}
                  </p>
                </div>
              )}

              {/* Help Topics */}
              {selectedCharacter.helpTopics && selectedCharacter.helpTopics.length > 0 && (
                <div>
                  <h3 className="text-white/40 text-xs uppercase tracking-wider mb-3">I can help you with</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedCharacter.helpTopics.map((topic, index) => (
                      <button
                        key={index}
                        className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-left hover:bg-white/10 transition-colors"
                      >
                        <span className="text-white text-sm font-medium block">{topic.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Settings button - bottom left (hidden on mobile) */}
      <div className="absolute left-4 bottom-4 z-20 hidden md:block">
        <button className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Character carousel */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-3">
          {/* Search button */}
          <button className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors opacity-50">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* Character avatars */}
          {(() => {
            const selectedIndex = CHARACTERS.findIndex(c => c.id === selectedCharacter.id);
            return CHARACTERS.map((character, index) => {
              const distance = Math.abs(index - selectedIndex);
              const isSelected = selectedCharacter.id === character.id;

              // Size: selected is 56px, others shrink based on distance
              const size = isSelected ? 56 : Math.max(32, 48 - distance * 8);
              // Opacity: selected is 1, others fade based on distance
              const opacity = isSelected ? 1 : Math.max(0.3, 1 - distance * 0.25);

              return (
                <button
                  key={character.id}
                  onClick={() => {
                    setSelectedCharacter(character);
                    router.push(`/room/${character.id}`);
                  }}
                  className="relative group transition-all duration-300 flex flex-col items-center"
                  style={{
                    opacity,
                    transform: `scale(${isSelected ? 1 : 0.9})`,
                  }}
                >
                  {/* Name label - shown above selected character */}
                  {isSelected && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-white/80 text-sm font-medium whitespace-nowrap">
                      {character.name}
                    </span>
                  )}
                  <div
                    className={`rounded-full overflow-hidden border-2 transition-all duration-300 ${
                      isSelected
                        ? "border-white"
                        : "border-transparent hover:border-white/50"
                    }`}
                    style={{
                      width: size,
                      height: size,
                    }}
                  >
                    {character.avatar.endsWith('.mov') || character.avatar.endsWith('.mp4') ? (
                      <video
                        src={character.avatar}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Image
                        src={character.avatar}
                        alt={character.name}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  {/* Hover name for non-selected */}
                  {!isSelected && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-white/80 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      {character.name}
                    </span>
                  )}
                </button>
              );
            });
          })()}
        </div>
      </div>

      {/* Send message and call buttons */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        <button
          onClick={handleSendMessage}
          className="px-6 py-2.5 rounded-full font-medium transition-all bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 whitespace-nowrap"
        >
          Send a message
        </button>
        {selectedCharacter.agentId && (
          <button
            onClick={handleCallClick}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all bg-green-500/80 backdrop-blur-sm border border-green-400/30 text-white hover:bg-green-500"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
            </svg>
          </button>
        )}
        {micError && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-red-500/90 text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap">
            {micError}
          </div>
        )}
      </div>

      {/* Draggable Nutz Button - Long-press (3s) to create agent */}
      <div
        className="absolute z-30 cursor-grab active:cursor-grabbing select-none transition-[width,height] duration-75"
        style={{
          left: nutzPosition.x,
          top: nutzPosition.y,
          transform: "translate(-50%, -50%)",
          width: nutzSize,
          height: nutzSize,
          opacity: nutzInitialized ? 1 : 0,
          WebkitTouchCallout: "none", // Prevent iOS image menu
        }}
        onMouseDown={(e) => {
          handleNutzMouseDown(e);
          handleNutzLongPressStart();
        }}
        onMouseUp={handleNutzLongPressEnd}
        onMouseLeave={handleNutzLongPressEnd}
        onTouchStart={(e) => {
          e.preventDefault(); // Prevent iOS image menu
          handleNutzLongPressStart();
        }}
        onTouchEnd={handleNutzLongPressEnd}
        onTouchCancel={handleNutzLongPressEnd}
        onContextMenu={(e) => e.preventDefault()} // Prevent context menu
      >
        <Image
          src="/nutz-button.png"
          alt="Nutz"
          width={400}
          height={400}
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
        />
      </div>

      {/* Home Screen with Commitments - show for Kagan when not in call */}
      {!showVoiceCall && selectedCharacter.id === "kagan" && userId && (
        <HomeScreen userId={userId} />
      )}

      {/* Voice Call Overlay */}
      {showVoiceCall && selectedCharacter.agentId && userId && (
        <VoiceCall
          agentId={selectedCharacter.agentId}
          characterName={selectedCharacter.name}
          userId={userId}
          onClose={() => setShowVoiceCall(false)}
        />
      )}

      {/* Creator Onboarding Modal - triggered by long-pressing NUTZ button */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={handleOnboardingComplete}
      />
    </div>
  );
}
