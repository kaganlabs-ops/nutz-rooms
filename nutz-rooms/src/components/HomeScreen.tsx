"use client";

import { useState, useEffect } from "react";
import { Commitment, getLocalCommitments, updateLocalCommitment } from "@/lib/commitments";
import { CommitmentCard } from "./CommitmentCard";

interface HomeScreenProps {
  userId: string;
}

export function HomeScreen({ userId }: HomeScreenProps) {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch commitments on mount
  useEffect(() => {
    const fetchCommitments = async () => {
      try {
        // Try API first
        const response = await fetch(`/api/commitments?userId=${userId}`);
        if (response.ok) {
          const data = await response.json();
          setCommitments(data.commitments || []);
        } else {
          // Fall back to localStorage
          setCommitments(getLocalCommitments(userId));
        }
      } catch {
        // Fall back to localStorage
        setCommitments(getLocalCommitments(userId));
      } finally {
        setLoading(false);
      }
    };

    fetchCommitments();
  }, [userId]);

  const handleComplete = async (id: string) => {
    // Optimistic update
    setCommitments(prev =>
      prev.map(c => (c.id === id ? { ...c, status: "completed" as const, updatedAt: new Date().toISOString() } : c))
    );

    // Update via API
    try {
      await fetch("/api/commitments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "completed" }),
      });
    } catch {
      // Also update localStorage as backup
      updateLocalCommitment(userId, id, { status: "completed" });
    }
  };

  const handleIncrementProgress = async (id: string) => {
    const commitment = commitments.find(c => c.id === id);
    if (!commitment?.progress) return;

    const newDone = commitment.progress.done + 1;
    const isComplete = newDone >= commitment.progress.total;

    // Optimistic update
    setCommitments(prev =>
      prev.map(c =>
        c.id === id
          ? {
              ...c,
              progress: { ...c.progress!, done: newDone },
              status: isComplete ? ("completed" as const) : c.status,
              updatedAt: new Date().toISOString(),
            }
          : c
      )
    );

    // Update via API
    try {
      await fetch("/api/commitments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          progress: { done: newDone, total: commitment.progress.total },
          status: isComplete ? "completed" : undefined,
        }),
      });
    } catch {
      updateLocalCommitment(userId, id, {
        progress: { done: newDone, total: commitment.progress.total },
        status: isComplete ? "completed" : undefined,
      });
    }
  };

  const activeCommitments = commitments.filter(c => c.status === "active");

  const hasCommitments = activeCommitments.length > 0;

  // Don't render anything if no commitments
  if (loading || !hasCommitments) {
    return null;
  }

  return (
    <div className="absolute inset-x-0 bottom-24 z-10 px-4">
      {/* Commitments List - compact at bottom */}
      <div className="max-w-md mx-auto space-y-2">
        {activeCommitments.slice(0, 3).map(commitment => (
          <CommitmentCard
            key={commitment.id}
            commitment={commitment}
            onComplete={handleComplete}
            onIncrementProgress={handleIncrementProgress}
          />
        ))}
      </div>
    </div>
  );
}
