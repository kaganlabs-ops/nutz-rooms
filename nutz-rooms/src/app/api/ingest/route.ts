import { NextRequest, NextResponse } from "next/server";
import { zep, KAGAN_USER_ID, ensureUser } from "@/lib/zep";

// Kagan's knowledge base - facts about him
const KAGAN_FACTS = [
  // Background
  "Kagan Sumer founded Gorillas, a rapid grocery delivery company",
  "Gorillas was founded in Berlin in 2020",
  "Gorillas raised over $1 billion in funding",
  "Gorillas was acquired by Getir in 2022",
  "Kagan is originally from Turkey",
  "Kagan is based in Berlin, Germany",

  // Expertise areas
  "Kagan has extensive experience in fundraising and pitching to investors",
  "Kagan built Gorillas from zero to billion-dollar valuation in under 2 years",
  "Kagan has experience scaling operations rapidly across multiple countries",
  "Kagan understands the challenges of building consumer-facing products",
  "Kagan has experience with on-demand delivery and logistics",

  // Philosophy and approach
  "Kagan believes in moving fast and iterating quickly",
  "Kagan emphasizes the importance of customer obsession",
  "Kagan values execution over perfect planning",
  "Kagan believes in hiring great people and empowering them",
  "Kagan learned that timing and market conditions are crucial for startup success",

  // Current interests
  "Kagan is currently interested in AI and building AI-powered products",
  "Kagan uses Claude as his primary AI assistant",
  "Kagan uses ElevenLabs for voice AI",
  "Kagan uses FAL for AI video generation",
  "Kagan builds with Next.js and modern web technologies",
  "Kagan is interested in the intersection of AI and consumer products",

  // Advice areas
  "Kagan can help founders with getting their first customers",
  "Kagan can help founders build compelling demos and MVPs",
  "Kagan can help founders craft their pitch decks",
  "Kagan can help founders with investor outreach and fundraising strategy",
  "Kagan advises on how to validate product-market fit quickly",

  // Lessons learned
  "Kagan learned that rapid growth requires strong unit economics eventually",
  "Kagan experienced both the highs of hypergrowth and the challenges of market downturns",
  "Kagan believes that brand building is underrated in tech startups",
  "Kagan values direct communication and honest feedback",
];

export async function POST(req: NextRequest) {
  try {
    // Ensure Kagan user exists
    await ensureUser(KAGAN_USER_ID, "Kagan", "Sumer");

    // Add facts to Kagan's knowledge graph
    let addedCount = 0;
    for (const fact of KAGAN_FACTS) {
      try {
        await zep.graph.add({
          userId: KAGAN_USER_ID,
          type: "text",
          data: fact,
        });
        addedCount++;
      } catch (e) {
        console.error(`Failed to add fact: ${fact}`, e);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Added ${addedCount} facts to Kagan's knowledge graph`,
      totalFacts: KAGAN_FACTS.length,
    });
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json(
      { error: "Failed to ingest knowledge" },
      { status: 500 }
    );
  }
}

// Also allow adding custom facts
export async function PUT(req: NextRequest) {
  try {
    const { facts } = await req.json();

    if (!facts || !Array.isArray(facts)) {
      return NextResponse.json(
        { error: "facts array is required" },
        { status: 400 }
      );
    }

    await ensureUser(KAGAN_USER_ID, "Kagan", "Sumer");

    let addedCount = 0;
    for (const fact of facts) {
      try {
        await zep.graph.add({
          userId: KAGAN_USER_ID,
          type: "text",
          data: fact,
        });
        addedCount++;
      } catch (e) {
        console.error(`Failed to add fact: ${fact}`, e);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Added ${addedCount} custom facts`,
    });
  } catch (error) {
    console.error("Custom ingest error:", error);
    return NextResponse.json(
      { error: "Failed to ingest custom facts" },
      { status: 500 }
    );
  }
}
