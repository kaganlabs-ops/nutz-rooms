import { NextRequest, NextResponse } from "next/server";
import * as fal from "@fal-ai/serverless-client";

fal.config({
  credentials: process.env.FAL_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to FAL storage
    const url = await fal.storage.upload(new Blob([buffer], { type: file.type }));

    console.log(`[UPLOAD] File uploaded: ${url}`);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[UPLOAD] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
