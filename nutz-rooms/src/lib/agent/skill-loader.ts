import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { Skill } from '@/types';

export class SkillLoader {
  private skills: Map<string, Skill> = new Map();
  private skillsDir: string;
  private loaded: boolean = false;

  constructor(skillsDir: string = 'src/lib/skills') {
    this.skillsDir = skillsDir;
  }

  // Load all skills from directory (call once at startup)
  async loadAll(): Promise<void> {
    if (this.loaded) return;

    const fullPath = path.join(process.cwd(), this.skillsDir);

    // Check if directory exists
    if (!fs.existsSync(fullPath)) {
      console.warn(`[SKILLS] Directory not found: ${fullPath}`);
      this.loaded = true;
      return;
    }

    const categories = fs.readdirSync(fullPath);

    for (const category of categories) {
      const categoryPath = path.join(fullPath, category);
      if (!fs.statSync(categoryPath).isDirectory()) continue;

      const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const filePath = path.join(categoryPath, file);
        const skill = this.loadSkillFile(filePath, category);
        if (skill) {
          this.skills.set(skill.slug, skill);
        }
      }
    }

    console.log(`[SKILLS] Loaded ${this.skills.size} skills`);
    this.loaded = true;
  }

  // Load single skill file
  private loadSkillFile(filePath: string, category: string): Skill | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data, content: markdown } = matter(content);

      const slug = path.basename(filePath, '.md');

      return {
        name: data.name || slug,
        slug: `${category}/${slug}`,
        description: data.description || '',
        triggers: data.triggers || [],
        content: markdown.trim(),
      };
    } catch (error) {
      console.error(`[SKILLS] Failed to load: ${filePath}`, error);
      return null;
    }
  }

  // Get skill by slug (e.g., "business/pitch-deck")
  get(slug: string): Skill | undefined {
    return this.skills.get(slug);
  }

  // Get multiple skills by slugs
  getByKeys(slugs: string[]): Skill[] {
    return slugs
      .map(slug => this.skills.get(slug))
      .filter((skill): skill is Skill => skill !== undefined);
  }

  // Get relevant skills based on message content (trigger matching)
  getRelevant(message: string, limit: number = 3): Skill[] {
    const lowerMessage = message.toLowerCase();

    const matched = Array.from(this.skills.values())
      .filter(skill =>
        skill.triggers.some(trigger =>
          lowerMessage.includes(trigger.toLowerCase())
        )
      )
      .slice(0, limit);

    return matched;
  }

  // Build system prompt section from skills
  buildSkillPrompt(skills: Skill[]): string {
    if (skills.length === 0) return '';

    const skillSections = skills
      .map(skill => `## ${skill.name}\n\n${skill.content}`)
      .join('\n\n---\n\n');

    return `\n\n# EXPERTISE & KNOWLEDGE\n\n${skillSections}`;
  }

  // Get all loaded skills
  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  // Check if skills have been loaded
  isLoaded(): boolean {
    return this.loaded;
  }
}

// Global instance
export const skillLoader = new SkillLoader();
