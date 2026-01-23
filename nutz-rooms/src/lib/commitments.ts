// Commitment storage and utilities
// For now, uses localStorage on client + simple API storage
// Later can be moved to Zep knowledge graph

export interface Commitment {
  id: string;
  userId: string;
  commitment: string;          // "3 user conversations"
  deadline: string;            // "Thursday" or "2025-01-23"
  frequency?: string;          // "3x this week"
  progress?: { done: number; total: number };
  status: "active" | "completed" | "missed";
  context?: string;            // "for Nuts validation"
  createdAt: string;
  updatedAt: string;
}

// Generate unique ID
export function generateCommitmentId(): string {
  return `commit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Parse deadline from natural language
export function parseDeadline(text: string): { deadline: string; displayDeadline: string } {
  const lower = text.toLowerCase();
  const today = new Date();

  // Day names
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayAbbrevs = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  // Check for specific days
  for (let i = 0; i < days.length; i++) {
    if (lower.includes(days[i]) || lower.includes(dayAbbrevs[i])) {
      const targetDay = i;
      const currentDay = today.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7; // Next week

      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysUntil);

      return {
        deadline: targetDate.toISOString().split('T')[0],
        displayDeadline: days[i].charAt(0).toUpperCase() + days[i].slice(1, 3)
      };
    }
  }

  // Check for "today"
  if (lower.includes('today')) {
    return {
      deadline: today.toISOString().split('T')[0],
      displayDeadline: 'Today'
    };
  }

  // Check for "tomorrow"
  if (lower.includes('tomorrow')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return {
      deadline: tomorrow.toISOString().split('T')[0],
      displayDeadline: 'Tomorrow'
    };
  }

  // Check for "this week" / "this weekend"
  if (lower.includes('this week') || lower.includes('weekend')) {
    const friday = new Date(today);
    const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
    friday.setDate(today.getDate() + daysUntilFriday);
    return {
      deadline: friday.toISOString().split('T')[0],
      displayDeadline: 'Fri'
    };
  }

  // Default to end of week
  const friday = new Date(today);
  const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
  friday.setDate(today.getDate() + daysUntilFriday);
  return {
    deadline: friday.toISOString().split('T')[0],
    displayDeadline: 'Fri'
  };
}

// Parse frequency from text like "3x this week"
export function parseFrequency(text: string): { frequency: string; total: number } | null {
  const match = text.match(/(\d+)\s*(?:x|times?)\s*(?:this\s+)?(?:week|day|per\s+week)/i);
  if (match) {
    const total = parseInt(match[1]);
    return {
      frequency: `${total}x this week`,
      total
    };
  }
  return null;
}

// Check if deadline is soon (within 2 days)
export function isDueSoon(commitment: Commitment): boolean {
  const deadline = new Date(commitment.deadline);
  const today = new Date();
  const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 2 && diffDays >= 0 && commitment.status === 'active';
}

// Check if commitment is overdue
export function isOverdue(commitment: Commitment): boolean {
  const deadline = new Date(commitment.deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return deadline < today && commitment.status === 'active';
}

// Format deadline for display
export function formatDeadlineDisplay(commitment: Commitment): string {
  if (commitment.progress) {
    return `${commitment.progress.done}/${commitment.progress.total}`;
  }

  const deadline = new Date(commitment.deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 0) return 'Overdue';

  // Return day name
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[deadline.getDay()];
}

// Build commitment context string for Kagan
export function buildCommitmentContext(commitments: Commitment[]): string {
  if (!commitments || commitments.length === 0) return '';

  const active = commitments.filter(c => c.status === 'active');
  const overdue = active.filter(c => isOverdue(c));
  const dueSoon = active.filter(c => isDueSoon(c) && !isOverdue(c));

  let context = '\n\nACTIVE COMMITMENTS:\n';

  for (const c of active) {
    const deadline = formatDeadlineDisplay(c);
    const progressStr = c.progress ? ` (${c.progress.done}/${c.progress.total})` : '';
    context += `- ${c.commitment}${progressStr} · ${deadline}${c.context ? ` (${c.context})` : ''}\n`;
  }

  if (overdue.length > 0) {
    context += `\nOVERDUE: ${overdue.map(c => c.commitment).join(', ')}\n`;
  }

  if (dueSoon.length > 0) {
    context += `\nDUE SOON: ${dueSoon.map(c => c.commitment).join(', ')}\n`;
  }

  return context;
}

// Client-side: Get commitments from localStorage
export function getLocalCommitments(userId: string): Commitment[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(`commitments-${userId}`);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

// Client-side: Save commitments to localStorage
export function saveLocalCommitments(userId: string, commitments: Commitment[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`commitments-${userId}`, JSON.stringify(commitments));
}

// Client-side: Add a commitment
export function addLocalCommitment(userId: string, commitment: Omit<Commitment, 'id' | 'createdAt' | 'updatedAt'>): Commitment {
  const now = new Date().toISOString();
  const newCommitment: Commitment = {
    ...commitment,
    id: generateCommitmentId(),
    createdAt: now,
    updatedAt: now,
  };

  const existing = getLocalCommitments(userId);
  existing.push(newCommitment);
  saveLocalCommitments(userId, existing);

  return newCommitment;
}

// Client-side: Update a commitment
export function updateLocalCommitment(userId: string, id: string, updates: Partial<Commitment>): Commitment | null {
  const commitments = getLocalCommitments(userId);
  const index = commitments.findIndex(c => c.id === id);
  if (index === -1) return null;

  commitments[index] = {
    ...commitments[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveLocalCommitments(userId, commitments);
  return commitments[index];
}

// Client-side: Mark commitment as complete
export function completeLocalCommitment(userId: string, id: string): Commitment | null {
  return updateLocalCommitment(userId, id, { status: 'completed' });
}

// Client-side: Increment progress on a recurring commitment
export function incrementProgress(userId: string, id: string): Commitment | null {
  const commitments = getLocalCommitments(userId);
  const commitment = commitments.find(c => c.id === id);
  if (!commitment || !commitment.progress) return null;

  const newDone = commitment.progress.done + 1;
  const updates: Partial<Commitment> = {
    progress: { done: newDone, total: commitment.progress.total }
  };

  // Auto-complete if done
  if (newDone >= commitment.progress.total) {
    updates.status = 'completed';
  }

  return updateLocalCommitment(userId, id, updates);
}
