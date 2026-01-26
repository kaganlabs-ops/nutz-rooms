import * as fal from '@fal-ai/serverless-client';
import { Tool, ToolContext, ToolResult } from '@/types';

// Configure FAL
fal.config({
  credentials: process.env.FAL_KEY,
});

// ============================================
// IMAGE GENERATION
// ============================================
// Map aspect ratios to FAL size presets
const SIZE_MAP: Record<string, string> = {
  '1:1': 'square_hd',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '4:3': 'landscape_4_3',
};

export async function generateImage(prompt: string, options?: {
  style?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3';
}): Promise<string> {
  const fullPrompt = options?.style ? `${prompt}, ${options.style} style` : prompt;
  const imageSize = SIZE_MAP[options?.aspectRatio || '1:1'] || 'square_hd';

  console.log(`[FAL] Generating image with prompt: "${fullPrompt}", size: ${imageSize}`);

  const result = await fal.subscribe('fal-ai/flux/schnell', {
    input: {
      prompt: fullPrompt,
      image_size: imageSize,
    },
  });

  console.log(`[FAL] Image generated successfully`);
  return (result as { images: Array<{ url: string }> }).images[0].url;
}

export async function generateImagePro(prompt: string): Promise<string> {
  const result = await fal.subscribe('fal-ai/flux-pro', {
    input: { prompt },
  });
  return (result as { images: Array<{ url: string }> }).images[0].url;
}

// ============================================
// IMAGE EDITING
// ============================================
export async function editImage(imageUrl: string, prompt: string): Promise<string> {
  console.log(`[FAL] Editing image with FLUX Pro Redux: "${prompt}"`);

  // Use FLUX Pro Redux for high-quality image editing
  const result = await fal.subscribe('fal-ai/flux-pro/v1/redux', {
    input: {
      image_url: imageUrl,
      prompt,
    },
  });

  console.log(`[FAL] Image edited successfully`);
  return (result as { images: Array<{ url: string }> }).images[0].url;
}

export async function removeBackground(imageUrl: string): Promise<string> {
  console.log(`[FAL] Removing background from: ${imageUrl}`);

  // Use birefnet (better quality than rembg)
  const result = await fal.subscribe('fal-ai/birefnet', {
    input: { image_url: imageUrl },
  });

  console.log(`[FAL] birefnet raw result:`, JSON.stringify(result, null, 2));

  // birefnet returns { image: { url } }
  const imageResult = result as { image?: { url: string } };
  if (!imageResult.image?.url) {
    console.error(`[FAL] Unexpected birefnet response structure:`, result);
    throw new Error('Background removal failed - unexpected response');
  }

  console.log(`[FAL] Background removed successfully: ${imageResult.image.url}`);
  return imageResult.image.url;
}

export async function upscaleImage(imageUrl: string): Promise<string> {
  console.log(`[FAL] Upscaling image: ${imageUrl}`);

  const result = await fal.subscribe('fal-ai/clarity-upscaler', {
    input: { image_url: imageUrl },
  });

  console.log(`[FAL] Image upscaled successfully`);
  return (result as { image: { url: string } }).image.url;
}

// ============================================
// VIDEO
// ============================================
export async function generateVideo(prompt: string): Promise<string> {
  console.log(`[FAL] Generating video with prompt: "${prompt}"`);

  const result = await fal.subscribe('fal-ai/minimax/video-01', {
    input: { prompt },
  });

  console.log(`[FAL] Video generated successfully`);
  return (result as { video: { url: string } }).video.url;
}

// ============================================
// AUDIO
// ============================================
export async function transcribe(audioUrl: string): Promise<string> {
  console.log(`[FAL] Transcribing audio: ${audioUrl}`);

  const result = await fal.subscribe('fal-ai/whisper', {
    input: { audio_url: audioUrl },
  });

  console.log(`[FAL] Audio transcribed successfully`);
  return (result as { text: string }).text;
}

export async function generateMusic(prompt: string): Promise<string> {
  console.log(`[FAL] Generating music with prompt: "${prompt}"`);

  const result = await fal.subscribe('fal-ai/stable-audio', {
    input: { prompt },
  });

  console.log(`[FAL] Music generated successfully`);
  return (result as { audio_file: { url: string } }).audio_file.url;
}

// ============================================
// TOOLS FOR AGENT
// ============================================
export const falTools: Tool[] = [
  {
    name: 'generate_image',
    description: 'Generate an image from a text description. Use for logos, mockups, illustrations, social media images.',
    parameters: {
      prompt: { type: 'string', description: 'What to generate', required: true },
      style: { type: 'string', description: 'Style (realistic, illustration, logo, 3d)', required: false },
      aspect_ratio: { type: 'string', description: 'Aspect ratio (1:1, 16:9, 9:16, 4:3)', required: false },
    },
    execute: async (params): Promise<ToolResult> => {
      try {
        const url = await generateImage(params.prompt as string, {
          style: params.style as string | undefined,
          aspectRatio: params.aspect_ratio as '1:1' | '16:9' | '9:16' | '4:3' | undefined,
        });
        return { success: true, data: { imageUrl: url } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Image generation failed' };
      }
    },
  },
  {
    name: 'edit_image',
    description: 'Edit an existing image based on instructions',
    parameters: {
      image_url: { type: 'string', description: 'URL of image to edit', required: true },
      instruction: { type: 'string', description: 'How to edit the image', required: true },
    },
    execute: async (params): Promise<ToolResult> => {
      try {
        const url = await editImage(params.image_url as string, params.instruction as string);
        return { success: true, data: { imageUrl: url } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Image edit failed' };
      }
    },
  },
  {
    name: 'remove_background',
    description: 'Remove the background from an image',
    parameters: {
      image_url: { type: 'string', description: 'URL of image', required: true },
    },
    execute: async (params): Promise<ToolResult> => {
      try {
        const url = await removeBackground(params.image_url as string);
        return { success: true, data: { imageUrl: url } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Background removal failed' };
      }
    },
  },
  {
    name: 'upscale_image',
    description: 'Upscale and enhance image quality',
    parameters: {
      image_url: { type: 'string', description: 'URL of image', required: true },
    },
    execute: async (params): Promise<ToolResult> => {
      try {
        const url = await upscaleImage(params.image_url as string);
        return { success: true, data: { imageUrl: url } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Upscale failed' };
      }
    },
  },
  {
    name: 'generate_video',
    description: 'Generate a short video from a text description',
    parameters: {
      prompt: { type: 'string', description: 'What to generate', required: true },
    },
    execute: async (params): Promise<ToolResult> => {
      try {
        const url = await generateVideo(params.prompt as string);
        return { success: true, data: { videoUrl: url } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Video generation failed' };
      }
    },
  },
  {
    name: 'transcribe_audio',
    description: 'Convert audio or video to text',
    parameters: {
      audio_url: { type: 'string', description: 'URL of audio/video file', required: true },
    },
    execute: async (params): Promise<ToolResult> => {
      try {
        const text = await transcribe(params.audio_url as string);
        return { success: true, data: { text } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Transcription failed' };
      }
    },
  },
  {
    name: 'generate_music',
    description: 'Generate music from a text description',
    parameters: {
      prompt: { type: 'string', description: 'Describe the music (genre, mood, instruments)', required: true },
    },
    execute: async (params): Promise<ToolResult> => {
      try {
        const url = await generateMusic(params.prompt as string);
        return { success: true, data: { audioUrl: url } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Music generation failed' };
      }
    },
  },
];
