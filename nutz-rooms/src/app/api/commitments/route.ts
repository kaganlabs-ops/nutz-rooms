import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { Commitment, generateCommitmentId } from "@/lib/commitments";

// Simple file-based storage for commitments
// In production, use a real database or Zep
const STORAGE_DIR = path.join(process.cwd(), ".data");
const STORAGE_FILE = path.join(STORAGE_DIR, "commitments.json");

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function readCommitments(): Record<string, Commitment[]> {
  ensureStorageDir();
  if (!fs.existsSync(STORAGE_FILE)) {
    return {};
  }
  try {
    const data = fs.readFileSync(STORAGE_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function writeCommitments(data: Record<string, Commitment[]>) {
  ensureStorageDir();
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
}

// GET /api/commitments?userId=X
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const allCommitments = readCommitments();
  const userCommitments = allCommitments[userId] || [];

  // Filter to only active + recently completed (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const filtered = userCommitments.filter((c) => {
    if (c.status === "active") return true;
    if (c.status === "completed") {
      const updatedAt = new Date(c.updatedAt);
      return updatedAt > sevenDaysAgo;
    }
    return false;
  });

  return NextResponse.json({ commitments: filtered });
}

// POST /api/commitments
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, commitment, deadline, frequency, progress, context } = body;

    if (!userId || !commitment) {
      return NextResponse.json(
        { error: "userId and commitment required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const newCommitment: Commitment = {
      id: generateCommitmentId(),
      userId,
      commitment,
      deadline: deadline || new Date().toISOString().split("T")[0],
      frequency,
      progress,
      status: "active",
      context,
      createdAt: now,
      updatedAt: now,
    };

    const allCommitments = readCommitments();
    if (!allCommitments[userId]) {
      allCommitments[userId] = [];
    }
    allCommitments[userId].push(newCommitment);
    writeCommitments(allCommitments);

    console.log("[COMMITMENTS] Created:", newCommitment.commitment, "for", userId);

    return NextResponse.json({ commitment: newCommitment });
  } catch (error) {
    console.error("[COMMITMENTS] Error creating:", error);
    return NextResponse.json({ error: "Failed to create commitment" }, { status: 500 });
  }
}

// PATCH /api/commitments (update by id in body)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, id, ...updates } = body;

    if (!userId || !id) {
      return NextResponse.json(
        { error: "userId and id required" },
        { status: 400 }
      );
    }

    const allCommitments = readCommitments();
    const userCommitments = allCommitments[userId] || [];
    const index = userCommitments.findIndex((c) => c.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    }

    // Update the commitment
    userCommitments[index] = {
      ...userCommitments[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    allCommitments[userId] = userCommitments;
    writeCommitments(allCommitments);

    console.log("[COMMITMENTS] Updated:", id, "status:", userCommitments[index].status);

    return NextResponse.json({ commitment: userCommitments[index] });
  } catch (error) {
    console.error("[COMMITMENTS] Error updating:", error);
    return NextResponse.json({ error: "Failed to update commitment" }, { status: 500 });
  }
}

// DELETE /api/commitments?userId=X&id=Y
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const id = searchParams.get("id");

  if (!userId || !id) {
    return NextResponse.json({ error: "userId and id required" }, { status: 400 });
  }

  const allCommitments = readCommitments();
  const userCommitments = allCommitments[userId] || [];
  const filtered = userCommitments.filter((c) => c.id !== id);

  if (filtered.length === userCommitments.length) {
    return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
  }

  allCommitments[userId] = filtered;
  writeCommitments(allCommitments);

  console.log("[COMMITMENTS] Deleted:", id);

  return NextResponse.json({ success: true });
}
