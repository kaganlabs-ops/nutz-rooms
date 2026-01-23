import { NextRequest, NextResponse } from "next/server";
import { agentBuilds } from "../chat/route";

export async function GET(req: NextRequest) {
  const buildId = req.nextUrl.searchParams.get("buildId");

  if (!buildId) {
    return NextResponse.json({ error: "buildId required" }, { status: 400 });
  }

  const buildEntry = agentBuilds.get(buildId);

  if (!buildEntry) {
    return NextResponse.json({ error: "Build not found" }, { status: 404 });
  }

  // Return current status
  const response: {
    status: string;
    deployedUrl?: string;
    document?: { title: string; content: string; type: string };
    error?: string;
    elapsed?: number;
  } = {
    status: buildEntry.status,
    elapsed: Date.now() - buildEntry.startTime,
  };

  if (buildEntry.status === "complete" && buildEntry.result) {
    response.deployedUrl = buildEntry.result.deployedUrl;
    response.document = buildEntry.result.document;

    // Clean up after successful retrieval
    setTimeout(() => agentBuilds.delete(buildId), 60000); // Keep for 1 minute
  }

  if (buildEntry.status === "error") {
    response.error = buildEntry.error;
  }

  return NextResponse.json(response);
}
