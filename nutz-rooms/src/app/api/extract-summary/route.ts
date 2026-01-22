import { NextRequest, NextResponse } from "next/server";
import { extractFromTranscript, hasContent } from "@/lib/extraction";
import { saveTaggedMemories, type TaggedMemoryData } from "@/lib/zep";

// POST /api/extract-summary
// Extract structured data from a voice call transcript
// Called at the end of a voice call to show summary card
export async function POST(req: NextRequest) {
  try {
    const { transcript, userId } = await req.json();

    if (!transcript || !Array.isArray(transcript)) {
      return NextResponse.json(
        { error: "transcript is required and must be an array" },
        { status: 400 }
      );
    }

    console.log(`[EXTRACT-SUMMARY] Processing ${transcript.length} messages for user: ${userId || 'unknown'}`);

    // Extract structured data from the full transcript
    const extraction = await extractFromTranscript(transcript);

    console.log(`[EXTRACT-SUMMARY] Extraction result:`, {
      commitment: extraction.commitment,
      parkingLotCount: extraction.parkingLotItems.length,
      insight: extraction.insight,
      blocker: extraction.blockerMentioned,
    });

    // If userId provided, save to Zep (fire and forget)
    if (userId && hasContent(extraction)) {
      const now = new Date().toISOString();
      const itemsToSave: TaggedMemoryData[] = [];

      if (extraction.commitment) {
        itemsToSave.push({
          type: 'commitment',
          content: extraction.commitment,
          date: now,
        });
      }

      for (const item of extraction.parkingLotItems) {
        itemsToSave.push({
          type: 'parking_lot',
          content: item,
          date: now,
        });
      }

      if (extraction.insight) {
        itemsToSave.push({
          type: 'insight',
          content: extraction.insight,
          date: now,
        });
      }

      if (extraction.blockerMentioned) {
        itemsToSave.push({
          type: 'blocker',
          content: extraction.blockerMentioned,
          date: now,
        });
      }

      if (itemsToSave.length > 0) {
        // Don't await - let it run in background
        saveTaggedMemories(userId, itemsToSave)
          .then(result => console.log(`[EXTRACT-SUMMARY] Saved ${result.saved} items to Zep`))
          .catch(err => console.error(`[EXTRACT-SUMMARY] Failed to save:`, err));
      }
    }

    // Return the extraction for the UI to display
    return NextResponse.json({
      oneThing: extraction.commitment,
      parkedItems: extraction.parkingLotItems,
      insight: extraction.insight,
      blocker: extraction.blockerMentioned,
      hasContent: hasContent(extraction),
    });
  } catch (error) {
    console.error("[EXTRACT-SUMMARY] Error:", error);
    return NextResponse.json(
      { error: "Failed to extract summary" },
      { status: 500 }
    );
  }
}
