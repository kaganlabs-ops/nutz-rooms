import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { deployPage, DEPLOY_PAGE_TOOL } from "@/lib/tools/deploy-page";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Tool definition for creating markdown documents
const CREATE_DOCUMENT_TOOL: Anthropic.Tool = {
  name: "create_document",
  description: `Create a markdown document for the user. Use this for:
- Planning docs (MVP scope, priorities, action plans)
- Clarity docs (ONE THING focus, parking lot)
- Outreach scripts, interview questions
- Meeting prep, decision docs
- Any text-based deliverable that doesn't need to be deployed

The document will be shown to the user as an artifact they can copy/save.`,
  input_schema: {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description: "Document title (e.g. 'MVP Scope - Lifting Recorder')",
      },
      content: {
        type: "string",
        description: "Full markdown content of the document",
      },
      type: {
        type: "string",
        enum: ["clarity", "mvp-scope", "action-plan", "outreach", "meeting-prep", "other"],
        description: "Type of document for categorization",
      },
    },
    required: ["title", "content", "type"],
  },
};

const AGENT_SYSTEM_PROMPT = `You are Kagan's execution engine. You DO things, not just talk about them.

You have THREE tools to choose from based on what the user needs:

1. **deploy_page** - Use this when user wants something to SHOW or DEMO
   - Working prototypes, apps, games, tools
   - Landing pages for validation
   - Interactive demos
   - Anything they can open in a browser and use

2. **create_document** - Use this when user wants to THINK or PLAN
   - Clarity docs (ONE THING, parking lot)
   - MVP scope (what's in, what's out)
   - Action plans with deadlines
   - Meeting prep, outreach scripts
   - Any planning/thinking deliverable

3. **web_search** - Use this for research
   - Competitor analysis
   - Market research
   - Finding information

## DECIDING WHICH TOOL TO USE

If user says: "demo", "show", "prototype", "app", "game", "page", "tool", "build me"
→ Use deploy_page (working code they can open)

If user says: "clarity", "plan", "organize", "priorities", "think through", "decide"
→ Use create_document (markdown doc)

If user asks about: competitors, market, validation data, "what's out there"
→ Use web_search (research)

## WHEN BUILDING (deploy_page)
- Generate clean, working HTML with inline CSS/JS
- Use Tailwind CSS via CDN
- Make it mobile-friendly and polished
- Include realistic sample data
- Return the live URL

## WHEN DOCUMENTING (create_document)
- Fill in specifics from the conversation (don't leave blanks)
- Take stances and make recommendations
- End with concrete actions + deadlines
- Reference Kagan's principles: ONE THING, first principles, tight deadlines

## RESPONSE FORMAT
Return a brief summary Kagan can speak naturally.
Example deploy: "Built you a quick prototype. Here's the link: [URL]. Try it out and show those trainers."
Example document: "Put together a clarity doc for you. Your ONE THING is X. Everything else goes in parking lot."

Don't be robotic. Make it flow like Kagan would say it.`;

interface AgentRequest {
  task: string;
  context: string;
  transcript?: { role: string; content: string }[];
}

// Store created document for returning to client
interface CreatedDocument {
  title: string;
  content: string;
  type: string;
}

export async function POST(req: NextRequest) {
  try {
    const { task, context, transcript }: AgentRequest = await req.json();

    console.log("[AGENT] ========================================");
    console.log("[AGENT] NEW REQUEST");
    console.log("[AGENT] Task:", task);
    console.log("[AGENT] Context length:", context?.length || 0);
    console.log("[AGENT] Transcript messages:", transcript?.length || 0);
    console.log("[AGENT] ========================================");

    const startTime = Date.now();

    // Build conversation context from transcript if provided
    const conversationContext = transcript
      ? transcript.slice(-10).map(m => `${m.role}: ${m.content}`).join("\n")
      : "";

    const userMessage = `Context from conversation:
${context}

${conversationContext ? `Recent conversation:\n${conversationContext}\n\n` : ""}Task: ${task}

Complete this task and return a concise summary I can speak to the user.`;

    // Track created artifacts
    let createdDocument: CreatedDocument | null = null;
    let deployedUrl: string | null = null;

    // Initial request with all tools
    console.log("[AGENT] Calling Claude Opus...");
    let response = await anthropic.messages.create({
      model: "claude-opus-4-5-20251101",
      max_tokens: 8192,
      system: AGENT_SYSTEM_PROMPT,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
        },
        DEPLOY_PAGE_TOOL as Anthropic.Tool,
        CREATE_DOCUMENT_TOOL,
      ],
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    console.log("[AGENT] Initial response stop_reason:", response.stop_reason);
    console.log("[AGENT] Initial response content types:", response.content.map(c => c.type));

    // Handle tool use loop
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    let loopCount = 0;
    const MAX_LOOPS = 10;

    while (response.stop_reason === "tool_use" && loopCount < MAX_LOOPS) {
      loopCount++;
      console.log("[AGENT] ----------------------------------------");
      console.log("[AGENT] Tool loop iteration:", loopCount);

      // Add assistant's response with tool use
      messages.push({
        role: "assistant",
        content: response.content,
      });

      // Process tool results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log("[AGENT] Tool use:", block.name);
          console.log("[AGENT] Tool input keys:", Object.keys(block.input as object));

          if (block.name === "web_search") {
            // web_search is handled automatically by the API
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: "Search completed - results provided by system",
            });
          } else if (block.name === "deploy_page") {
            // Handle deploy_page tool
            try {
              const input = block.input as { name: string; code: string };
              console.log("[AGENT] Deploying page:", input.name);
              const deployResult = await deployPage(input);
              console.log("[AGENT] Deploy success:", deployResult.url);
              deployedUrl = deployResult.url;
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({
                  success: true,
                  url: deployResult.url,
                }),
              });
            } catch (err) {
              console.error("[AGENT] Deploy failed:", err);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({
                  success: false,
                  error: err instanceof Error ? err.message : "Deploy failed",
                }),
                is_error: true,
              });
            }
          } else if (block.name === "create_document") {
            // Handle create_document tool
            const input = block.input as { title: string; content: string; type: string };
            console.log("[AGENT] Creating document:", input.title);
            createdDocument = input;
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify({
                success: true,
                message: "Document created successfully",
              }),
            });
          }
        }
      }

      // Add tool results
      messages.push({
        role: "user",
        content: toolResults,
      });

      // Continue the conversation
      response = await anthropic.messages.create({
        model: "claude-opus-4-5-20251101",
        max_tokens: 8192,
        system: AGENT_SYSTEM_PROMPT,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 5,
          },
          DEPLOY_PAGE_TOOL as Anthropic.Tool,
          CREATE_DOCUMENT_TOOL,
        ],
        messages,
      });
    }

    // Extract final text result
    let result = "";
    const sources: string[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        result += block.text;
      }
    }

    const elapsed = Date.now() - startTime;
    console.log("[AGENT] Completed in", elapsed + "ms");
    console.log("[AGENT] Result length:", result.length);
    if (deployedUrl) console.log("[AGENT] Deployed URL:", deployedUrl);
    if (createdDocument) console.log("[AGENT] Created document:", createdDocument.title);

    return Response.json({
      result,
      sources,
      elapsed,
      // Include artifacts created by agent
      deployedUrl,
      document: createdDocument,
    });
  } catch (error) {
    console.error("[AGENT] Error:", error);

    // Return graceful error message Kagan can speak
    return Response.json({
      result: "Having trouble looking that up right now. Can you tell me more about the space yourself?",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
