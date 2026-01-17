"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

type VideoState = "idle" | "listening" | "speaking";

interface Character {
  id: string;
  name: string;
  avatar: string;
  phone?: string;
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
    avatar: "/kagan-avatar.jpg",
    phone: "4917665845156",
    videoSources: {
      idle: "https://v3b.fal.media/files/b/0a89ae17/C0eaf9KGKYo4KL7-rUSTR_output.mp4",
      listening: "https://v3b.fal.media/files/b/0a89ae17/C0eaf9KGKYo4KL7-rUSTR_output.mp4",
      speaking: "https://v3b.fal.media/files/b/0a89ae17/C0eaf9KGKYo4KL7-rUSTR_output.mp4",
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
];

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [videoState] = useState<VideoState>("idle");
  const videoRef = useRef<HTMLVideoElement>(null);


  // Nutz button state
  const [nutzPosition, setNutzPosition] = useState({ x: 80, y: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [nutzSize, setNutzSize] = useState(64);
  const dragOffset = useRef({ x: 0, y: 0 });

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
    setIsDragging(false);
  }, []);

  const handleSendMessage = () => {
    if (selectedCharacter?.phone) {
      window.open(`https://wa.me/${selectedCharacter.phone}`, "_blank");
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
    <div className="min-h-screen bg-black relative overflow-hidden">
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

      {/* Left sidebar */}
      <div className="absolute left-4 top-4 bottom-4 flex flex-col justify-between z-20">
        <div className="flex flex-col gap-4">
          {/* Home */}
          <button
            onClick={() => router.push("/")}
            className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
        </div>

        {/* Settings */}
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
                    <Image
                      src={character.avatar}
                      alt={character.name}
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                    />
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

      {/* Send message button */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        <button
          onClick={handleSendMessage}
          className="px-6 py-2.5 rounded-full font-medium transition-all bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20"
        >
          Send a message
        </button>
      </div>

      {/* Draggable Nutz Button */}
      <div
        className="absolute z-30 cursor-grab active:cursor-grabbing select-none transition-[width,height] duration-75"
        style={{
          left: nutzPosition.x,
          top: nutzPosition.y,
          transform: "translate(-100%, -50%)",
          width: nutzSize,
          height: nutzSize,
        }}
        onMouseDown={handleNutzMouseDown}
      >
        <Image
          src="/nutz-button.png"
          alt="Nutz"
          width={400}
          height={400}
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>
    </div>
  );
}
