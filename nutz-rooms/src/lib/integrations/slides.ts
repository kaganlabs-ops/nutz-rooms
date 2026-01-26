import pptxgen from 'pptxgenjs';
import { Tool, ToolResult } from '@/types';

// ============================================
// SLIDE GENERATION
// ============================================

interface SlideContent {
  title: string;
  bullets?: string[];
  image_url?: string;
  notes?: string;
}

interface PresentationOptions {
  title: string;
  author?: string;
  slides: SlideContent[];
}

export async function createPresentation(options: PresentationOptions): Promise<Buffer> {
  const pres = new pptxgen();

  pres.title = options.title;
  if (options.author) {
    pres.author = options.author;
  }

  // Set default slide layout
  pres.defineLayout({ name: 'CUSTOM', width: 10, height: 7.5 });
  pres.layout = 'CUSTOM';

  for (const slideContent of options.slides) {
    const slide = pres.addSlide();

    // Add title
    slide.addText(slideContent.title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 1,
      fontSize: 32,
      bold: true,
      color: '363636',
    });

    // Add bullets if provided
    if (slideContent.bullets && slideContent.bullets.length > 0) {
      slide.addText(
        slideContent.bullets.map(b => ({ text: b, options: { bullet: true } })),
        {
          x: 0.5,
          y: 1.8,
          w: slideContent.image_url ? 5 : 9,
          h: 5,
          fontSize: 18,
          color: '666666',
          valign: 'top',
        }
      );
    }

    // Add image if provided
    if (slideContent.image_url) {
      slide.addImage({
        path: slideContent.image_url,
        x: 6,
        y: 1.8,
        w: 3.5,
        h: 4.5,
      });
    }

    // Add speaker notes if provided
    if (slideContent.notes) {
      slide.addNotes(slideContent.notes);
    }
  }

  // Generate as buffer
  const data = await pres.write({ outputType: 'arraybuffer' });
  return Buffer.from(data as ArrayBuffer);
}

// ============================================
// TOOL FOR AGENT
// ============================================
export const slidesTools: Tool[] = [
  {
    name: 'create_slides',
    description: `Create a PowerPoint presentation. Returns the slides as a downloadable file.

Use for:
- Pitch decks
- Meeting presentations
- Project updates
- Training materials`,
    parameters: {
      title: { type: 'string', description: 'Presentation title', required: true },
      slides: {
        type: 'array',
        description: 'Array of slide objects with title, bullets (array), image_url (optional), notes (optional)',
        required: true,
      },
      author: { type: 'string', description: 'Author name', required: false },
    },
    execute: async (params): Promise<ToolResult> => {
      try {
        const slides = params.slides as SlideContent[];
        const buffer = await createPresentation({
          title: params.title as string,
          author: params.author as string | undefined,
          slides,
        });

        // Convert to base64 for transport
        const base64 = buffer.toString('base64');

        return {
          success: true,
          data: {
            base64,
            filename: `${(params.title as string).toLowerCase().replace(/\s+/g, '-')}.pptx`,
            mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          },
        };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Slide creation failed' };
      }
    },
  },
];
