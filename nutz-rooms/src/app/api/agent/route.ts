import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { deployPage, DEPLOY_PAGE_TOOL } from "@/lib/tools/deploy-page";
import { generateImage, generateVideo, generateMusic, removeBackground, upscaleImage } from "@/lib/integrations/fal";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// FAL tool definitions
const GENERATE_IMAGE_TOOL: Anthropic.Tool = {
  name: "generate_image",
  description: "Generate an image from a text description. Use for any image request: dog pictures, logos, mockups, art, social media images, anything visual.",
  input_schema: {
    type: "object" as const,
    properties: {
      prompt: {
        type: "string",
        description: "What to generate - be detailed and specific",
      },
      style: {
        type: "string",
        enum: ["realistic", "illustration", "logo", "3d", "anime", "painting"],
        description: "Style of the image",
      },
      aspect_ratio: {
        type: "string",
        enum: ["1:1", "16:9", "9:16", "4:3"],
        description: "Aspect ratio (default 1:1)",
      },
    },
    required: ["prompt"],
  },
};

const GENERATE_VIDEO_TOOL: Anthropic.Tool = {
  name: "generate_video",
  description: "Generate a short video from a text description.",
  input_schema: {
    type: "object" as const,
    properties: {
      prompt: {
        type: "string",
        description: "What to generate in the video",
      },
    },
    required: ["prompt"],
  },
};

const GENERATE_MUSIC_TOOL: Anthropic.Tool = {
  name: "generate_music",
  description: "Generate music from a text description (genre, mood, instruments).",
  input_schema: {
    type: "object" as const,
    properties: {
      prompt: {
        type: "string",
        description: "Describe the music (genre, mood, instruments)",
      },
    },
    required: ["prompt"],
  },
};

const REMOVE_BACKGROUND_TOOL: Anthropic.Tool = {
  name: "remove_background",
  description: "Remove the background from an image.",
  input_schema: {
    type: "object" as const,
    properties: {
      image_url: {
        type: "string",
        description: "URL of the image to process",
      },
    },
    required: ["image_url"],
  },
};

const UPSCALE_IMAGE_TOOL: Anthropic.Tool = {
  name: "upscale_image",
  description: "Upscale and enhance image quality.",
  input_schema: {
    type: "object" as const,
    properties: {
      image_url: {
        type: "string",
        description: "URL of the image to upscale",
      },
    },
    required: ["image_url"],
  },
};

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

You have these tools:

1. **generate_image** - Generate ANY image: dogs, cats, logos, art, mockups, anything visual
   - User says "picture", "image", "photo", "draw", "generate" → USE THIS
   - Be detailed in prompts for better results

2. **generate_video** - Generate short videos from descriptions

3. **generate_music** - Generate music (describe genre, mood, instruments)

4. **remove_background** - Remove background from an image

5. **upscale_image** - Enhance image quality

6. **deploy_page** - Build working prototypes, apps, games, landing pages

7. **create_document** - Create planning docs, clarity docs, outreach scripts

8. **web_search** - Research competitors, market, find information

## DECIDING WHICH TOOL TO USE

If user says: "picture", "image", "photo", "draw", "generate an image", "make me a", "dog", "cat", "logo"
→ Use generate_image (this is the most common request!)

If user says: "video", "animation", "clip"
→ Use generate_video

If user says: "music", "song", "beat", "audio"
→ Use generate_music

If user says: "demo", "show", "prototype", "app", "game", "page", "tool", "build me"
→ Use deploy_page (working code they can open)

If user says: "clarity", "plan", "organize", "priorities", "think through", "decide"
→ Use create_document (markdown doc)

If user asks about: competitors, market, validation data, "what's out there"
→ Use web_search (research)

## WHEN BUILDING (deploy_page)
- Generate clean, working HTML with inline CSS/JS
- Use Tailwind CSS via CDN

CRITICAL - MOBILE FIRST:
- User is on mobile phone. EVERYTHING must work on touch screens.
- Add viewport meta: <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
- Use 100vw/100vh or percentages, NOT fixed pixel widths
- For games: use TOUCH events (touchstart, touchmove, touchend), not just click
- Buttons must be large (min 44px touch target)
- No hover states - use active/focus for mobile
- Test mentally: "would this work on a 375px wide screen with fat fingers?"

FOR GAMES SPECIFICALLY:
- Canvas/game area must fit mobile viewport (use vw/vh units)
- Add on-screen touch controls (buttons, swipe areas)
- Tetris: arrow buttons at bottom for left/right/down/rotate
- Connect 4: tap columns to drop pieces
- Snake: swipe or d-pad controls
- Make game area responsive, scale to screen

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
    let generatedImageUrl: string | null = null;
    let generatedVideoUrl: string | null = null;
    let generatedAudioUrl: string | null = null;

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
        GENERATE_IMAGE_TOOL,
        GENERATE_VIDEO_TOOL,
        GENERATE_MUSIC_TOOL,
        REMOVE_BACKGROUND_TOOL,
        UPSCALE_IMAGE_TOOL,
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
          } else if (block.name === "generate_image") {
            // Handle image generation
            try {
              const input = block.input as { prompt: string; style?: string; aspect_ratio?: string };
              console.log("[AGENT] Generating image:", input.prompt);
              const imageUrl = await generateImage(input.prompt, {
                style: input.style,
                aspectRatio: input.aspect_ratio as '1:1' | '16:9' | '9:16' | '4:3' | undefined,
              });
              console.log("[AGENT] Image generated:", imageUrl);
              generatedImageUrl = imageUrl;
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({ success: true, imageUrl }),
              });
            } catch (err) {
              console.error("[AGENT] Image generation failed:", err);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Image generation failed" }),
                is_error: true,
              });
            }
          } else if (block.name === "generate_video") {
            // Handle video generation
            try {
              const input = block.input as { prompt: string };
              console.log("[AGENT] Generating video:", input.prompt);
              const videoUrl = await generateVideo(input.prompt);
              console.log("[AGENT] Video generated:", videoUrl);
              generatedVideoUrl = videoUrl;
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({ success: true, videoUrl }),
              });
            } catch (err) {
              console.error("[AGENT] Video generation failed:", err);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Video generation failed" }),
                is_error: true,
              });
            }
          } else if (block.name === "generate_music") {
            // Handle music generation
            try {
              const input = block.input as { prompt: string };
              console.log("[AGENT] Generating music:", input.prompt);
              const audioUrl = await generateMusic(input.prompt);
              console.log("[AGENT] Music generated:", audioUrl);
              generatedAudioUrl = audioUrl;
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({ success: true, audioUrl }),
              });
            } catch (err) {
              console.error("[AGENT] Music generation failed:", err);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Music generation failed" }),
                is_error: true,
              });
            }
          } else if (block.name === "remove_background") {
            // Handle background removal
            try {
              const input = block.input as { image_url: string };
              console.log("[AGENT] Removing background from:", input.image_url);
              const imageUrl = await removeBackground(input.image_url);
              console.log("[AGENT] Background removed:", imageUrl);
              generatedImageUrl = imageUrl;
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({ success: true, imageUrl }),
              });
            } catch (err) {
              console.error("[AGENT] Background removal failed:", err);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Background removal failed" }),
                is_error: true,
              });
            }
          } else if (block.name === "upscale_image") {
            // Handle image upscaling
            try {
              const input = block.input as { image_url: string };
              console.log("[AGENT] Upscaling image:", input.image_url);
              const imageUrl = await upscaleImage(input.image_url);
              console.log("[AGENT] Image upscaled:", imageUrl);
              generatedImageUrl = imageUrl;
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({ success: true, imageUrl }),
              });
            } catch (err) {
              console.error("[AGENT] Image upscaling failed:", err);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Image upscaling failed" }),
                is_error: true,
              });
            }
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
          GENERATE_IMAGE_TOOL,
          GENERATE_VIDEO_TOOL,
          GENERATE_MUSIC_TOOL,
          REMOVE_BACKGROUND_TOOL,
          UPSCALE_IMAGE_TOOL,
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
      imageUrl: generatedImageUrl,
      videoUrl: generatedVideoUrl,
      audioUrl: generatedAudioUrl,
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
