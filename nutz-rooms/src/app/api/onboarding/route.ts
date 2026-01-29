import { NextRequest, NextResponse } from "next/server";
import {
  parseChatExport,
  transcribeAudio,
  parseDocument,
  fetchYouTubeTranscript,
  fetchTwitterProfile,
  analyzePersonality,
  ExtractedContent,
} from "@/lib/onboarding/extract-personality";
import {
  generateCreatorConfig,
  generateCreatorFile,
} from "@/lib/onboarding/generate-config";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Helper to upload file to temp storage and get URL (for audio transcription)
async function uploadToTempStorage(file: File): Promise<string> {
  // In production, upload to S3/Cloudflare R2/etc and return URL
  // For now, save locally and return file path
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

  const fileName = `${Date.now()}-${file.name}`;
  const filePath = path.join(uploadDir, fileName);
  await writeFile(filePath, buffer);

  // Return URL accessible by FAL
  // In production, this should be a public URL
  return `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/uploads/${fileName}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const creatorName = formData.get("creatorName") as string;
    if (!creatorName) {
      return NextResponse.json({ error: "Creator name is required" }, { status: 400 });
    }

    // Collect files and URLs
    const files = formData.getAll("files") as File[];
    const fileTypes = formData.getAll("fileTypes") as string[];
    const urls = formData.getAll("urls") as string[];
    const urlTypes = formData.getAll("urlTypes") as string[];

    if (files.length === 0 && urls.length === 0) {
      return NextResponse.json({ error: "At least one source is required" }, { status: 400 });
    }

    // Process all sources
    const extractedContents: ExtractedContent[] = [];

    // Process files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = fileTypes[i] as "chat" | "audio" | "document";

      try {
        if (type === "audio") {
          // Upload and transcribe
          const audioUrl = await uploadToTempStorage(file);
          const extracted = await transcribeAudio(audioUrl, file.name);
          extractedContents.push(extracted);
        } else if (type === "chat") {
          // Parse chat export
          const text = await file.text();
          const extracted = await parseChatExport(text, file.name);
          extractedContents.push(extracted);
        } else if (type === "document") {
          // Parse document
          const text = await file.text();
          const extracted = await parseDocument(text, file.name);
          extractedContents.push(extracted);
        }
      } catch (err) {
        console.error(`Error processing ${file.name}:`, err);
        // Continue with other files
      }
    }

    // Process URLs
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const type = urlTypes[i] as "youtube" | "twitter";

      try {
        if (type === "youtube") {
          const extracted = await fetchYouTubeTranscript(url);
          extractedContents.push(extracted);
        } else if (type === "twitter") {
          const extracted = await fetchTwitterProfile(url);
          extractedContents.push(extracted);
        }
      } catch (err) {
        console.error(`Error processing ${url}:`, err);
        // Continue with other URLs
      }
    }

    if (extractedContents.length === 0) {
      return NextResponse.json({ error: "No sources could be processed" }, { status: 400 });
    }

    // Analyze personality using Claude
    const analysis = await analyzePersonality(extractedContents, creatorName);

    // Generate creator config
    const config = generateCreatorConfig({
      name: creatorName,
      ...analysis,
    });

    // Generate TypeScript file content
    const fileContent = generateCreatorFile(config);

    // Save creator file (optional - in production this might go to a database)
    const creatorsDir = path.join(process.cwd(), "src", "lib", "creators");
    const creatorFilePath = path.join(creatorsDir, `${config.id}.ts`);

    try {
      await writeFile(creatorFilePath, fileContent);
      console.log(`[ONBOARDING] Created creator file: ${creatorFilePath}`);
    } catch (err) {
      console.error("[ONBOARDING] Could not save creator file:", err);
      // Continue anyway - we can still return the config
    }

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        name: config.name,
        personality: config.personality.basePrompt,
        voiceTone: analysis.voiceTone,
        keyStories: analysis.keyStories,
        philosophy: analysis.philosophy,
        vocabulary: analysis.vocabulary,
        expertise: analysis.expertise,
      },
      fileContent,
    });
  } catch (error) {
    console.error("[ONBOARDING] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    );
  }
}
