"use client";

import { useState } from "react";
import { Commitment, formatDeadlineDisplay, isOverdue, isDueSoon } from "@/lib/commitments";

interface CommitmentCardProps {
  commitment: Commitment;
  onComplete: (id: string) => void;
  onIncrementProgress?: (id: string) => void;
  compact?: boolean;
}

export function CommitmentCard({
  commitment,
  onComplete,
  onIncrementProgress,
  compact = false,
}: CommitmentCardProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const isComplete = commitment.status === "completed";
  const overdue = isOverdue(commitment);
  const dueSoon = isDueSoon(commitment);
  const hasProgress = !!commitment.progress;
  const deadlineDisplay = formatDeadlineDisplay(commitment);

  const handleClick = () => {
    if (isComplete) return;

    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    if (hasProgress && onIncrementProgress) {
      onIncrementProgress(commitment.id);
    } else {
      onComplete(commitment.id);
    }
  };

  if (compact) {
    // Compact version for during call
    return (
      <button
        onClick={handleClick}
        disabled={isComplete}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all ${
          isComplete
            ? "bg-green-900/30 text-green-400"
            : overdue
            ? "bg-red-900/30 text-red-400 hover:bg-red-900/50"
            : dueSoon
            ? "bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50"
            : "bg-white/10 text-white/70 hover:bg-white/20"
        } ${isAnimating ? "scale-95" : ""}`}
      >
        <span className="text-sm">
          {isComplete ? "✓" : hasProgress ? "■" : "□"}
        </span>
        <span className="truncate max-w-[100px]">{commitment.commitment}</span>
        <span className="text-white/40">·</span>
        <span className={overdue ? "text-red-400" : "text-white/50"}>
          {deadlineDisplay}
        </span>
      </button>
    );
  }

  // Full version for home screen
  return (
    <button
      onClick={handleClick}
      disabled={isComplete}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        isComplete
          ? "bg-green-900/20 border border-green-500/30"
          : overdue
          ? "bg-red-900/20 border border-red-500/30 hover:bg-red-900/30"
          : dueSoon
          ? "bg-yellow-900/20 border border-yellow-500/30 hover:bg-yellow-900/30"
          : "bg-white/5 border border-white/10 hover:bg-white/10"
      } ${isAnimating ? "scale-[0.98]" : ""}`}
    >
      {/* Checkbox */}
      <div
        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
          isComplete
            ? "bg-green-500 border-green-500 text-white"
            : hasProgress
            ? "border-white/30"
            : "border-white/30 hover:border-white/50"
        }`}
      >
        {isComplete ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : hasProgress ? (
          <span className="text-xs text-white/70">
            {commitment.progress!.done}
          </span>
        ) : null}
      </div>

      {/* Content */}
      <div className="flex-1 text-left">
        <p
          className={`text-sm ${
            isComplete ? "text-white/50 line-through" : "text-white"
          }`}
        >
          {commitment.commitment}
        </p>
        {commitment.context && (
          <p className="text-xs text-white/40 mt-0.5">{commitment.context}</p>
        )}
      </div>

      {/* Deadline / Progress */}
      <div className="text-right">
        {hasProgress ? (
          <div className="flex items-center gap-1">
            {Array.from({ length: commitment.progress!.total }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-4 rounded-sm ${
                  i < commitment.progress!.done
                    ? "bg-green-500"
                    : "bg-white/20"
                }`}
              />
            ))}
          </div>
        ) : (
          <span
            className={`text-sm font-medium ${
              isComplete
                ? "text-green-400"
                : overdue
                ? "text-red-400"
                : dueSoon
                ? "text-yellow-400"
                : "text-white/50"
            }`}
          >
            {deadlineDisplay}
          </span>
        )}
      </div>
    </button>
  );
}
