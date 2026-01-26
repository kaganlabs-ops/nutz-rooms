import { NextRequest, NextResponse } from "next/server";
import { getTaskEntry } from "@/lib/redis";

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  const taskEntry = await getTaskEntry(taskId);

  if (!taskEntry) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const response: {
    status: string;
    type: string;
    description: string;
    result?: {
      imageUrl?: string;
      videoUrl?: string;
      audioUrl?: string;
      text?: string;
      data?: unknown;
    };
    error?: string;
    elapsed?: number;
  } = {
    status: taskEntry.status,
    type: taskEntry.type,
    description: taskEntry.description,
    elapsed: Date.now() - taskEntry.startTime,
  };

  if (taskEntry.status === "complete") {
    response.result = taskEntry.result;
  }

  if (taskEntry.status === "error") {
    response.error = taskEntry.error;
  }

  return NextResponse.json(response);
}
