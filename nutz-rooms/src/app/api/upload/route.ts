import { NextRequest, NextResponse } from "next/server";
import * as fal from "@fal-ai/serverless-client";

fal.config({
  credentials: process.env.FAL_KEY,
});

export async function POST(req: NextRequest) {
  try {
    console.log("[UPLOAD] Starting upload...");
    console.log("[UPLOAD] FAL_KEY present:", !!process.env.FAL_KEY);

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      console.log("[UPLOAD] No file in formData");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log(`[UPLOAD] File received: ${file.name}, size: ${file.size}, type: ${file.type}`);

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only images are allowed" }, { status: 400 });
    }

    // Convert to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    console.log(`[UPLOAD] Buffer created, size: ${buffer.length}`);

    // Try FAL storage upload
    try {
      const url = await fal.storage.upload(new Blob([buffer], { type: file.type }));
      console.log(`[UPLOAD] FAL upload successful: ${url}`);
      return NextResponse.json({ url });
    } catch (falError) {
      console.error("[UPLOAD] FAL storage error:", falError);

      // Fallback: return as base64 data URL for smaller images (under 1MB)
      if (buffer.length < 1024 * 1024) {
        console.log("[UPLOAD] Falling back to base64 data URL");
        const base64 = buffer.toString('base64');
        const dataUrl = `data:${file.type};base64,${base64}`;
        return NextResponse.json({ url: dataUrl });
      }

      throw falError;
    }
  } catch (error) {
    console.error("[UPLOAD] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Upload failed";
    console.error("[UPLOAD] Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
