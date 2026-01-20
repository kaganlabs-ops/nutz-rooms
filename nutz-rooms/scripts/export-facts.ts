import { ZepClient } from "@getzep/zep-cloud";
import * as fs from "fs";
import * as path from "path";

// Load environment variables manually
const envPath = path.join(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const [key, ...valueParts] = line.split("=");
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join("=").trim();
  }
}

const KAGAN_USER_ID = "kagan-sumer";

console.log("API Key loaded:", process.env.ZEP_API_KEY ? "Yes (length: " + process.env.ZEP_API_KEY.length + ")" : "No");

async function exportFacts() {
  const zep = new ZepClient({
    apiKey: process.env.ZEP_API_KEY!,
  });

  console.log("Fetching all edges for user:", KAGAN_USER_ID);

  try {
    // Get all edges for the user with pagination
    let allEdges: any[] = [];
    let cursor: string | undefined = undefined;
    let page = 1;

    while (true) {
      console.log(`Fetching page ${page}...`);
      const response = await zep.graph.edge.getByUserId(KAGAN_USER_ID, {
        limit: 500,
        uuidCursor: cursor,
      });

      // Response is directly an array of edges
      const edges = Array.isArray(response) ? response : (response as any).data || [];
      console.log(`Page ${page}: Found ${edges.length} edges`);

      if (edges.length === 0) break;

      allEdges = allEdges.concat(edges);

      // Get the last edge UUID for pagination
      const lastEdge = edges[edges.length - 1];
      if (lastEdge && lastEdge.uuid) {
        cursor = lastEdge.uuid;
      } else {
        break;
      }

      // If we got less than limit, we're done
      if (edges.length < 500) break;

      page++;
    }

    const edges = allEdges;
    console.log(`Total: Found ${edges.length} edges`);

    // Extract facts and organize by category
    const facts: Array<{
      fact: string;
      createdAt?: string;
      uuid: string;
      relation?: string;
    }> = [];

    for (const edge of edges) {
      if (edge.fact) {
        facts.push({
          fact: edge.fact,
          createdAt: edge.createdAt,
          uuid: edge.uuid || "",
          relation: edge.name,
        });
      }
    }

    console.log(`Extracted ${facts.length} facts`);

    // Sort by creation date (newest first)
    facts.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Generate markdown output
    let markdown = `# Kagan Sumer - Knowledge Graph Facts

**Total Facts:** ${facts.length}
**Exported:** ${new Date().toISOString()}
**User ID:** ${KAGAN_USER_ID}

---

## All Facts

`;

    // Group facts by rough category based on content
    const categories: Record<string, typeof facts> = {
      "Background & Personal": [],
      "Gorillas & Business": [],
      "Skills & Expertise": [],
      "Philosophy & Values": [],
      "AI & Tech": [],
      "Mode State & System": [],
      "Other": [],
    };

    for (const f of facts) {
      const lower = f.fact.toLowerCase();

      if (lower.includes("mode_state") || lower.includes("toolkit mode") || lower.includes("completed toolkit")) {
        categories["Mode State & System"].push(f);
      } else if (lower.includes("gorillas") || lower.includes("getir") || lower.includes("billion") || lower.includes("funding") || lower.includes("startup")) {
        categories["Gorillas & Business"].push(f);
      } else if (lower.includes("turkish") || lower.includes("berlin") || lower.includes("turkey") || lower.includes("background") || lower.includes("born") || lower.includes("personal")) {
        categories["Background & Personal"].push(f);
      } else if (lower.includes("ai") || lower.includes("claude") || lower.includes("elevenlabs") || lower.includes("fal") || lower.includes("next.js") || lower.includes("tech")) {
        categories["AI & Tech"].push(f);
      } else if (lower.includes("fundraising") || lower.includes("pitch") || lower.includes("investor") || lower.includes("scaling") || lower.includes("customer") || lower.includes("product") || lower.includes("help") || lower.includes("advise")) {
        categories["Skills & Expertise"].push(f);
      } else if (lower.includes("believe") || lower.includes("value") || lower.includes("philosophy") || lower.includes("learned") || lower.includes("important")) {
        categories["Philosophy & Values"].push(f);
      } else {
        categories["Other"].push(f);
      }
    }

    // Write each category
    for (const [category, categoryFacts] of Object.entries(categories)) {
      if (categoryFacts.length === 0) continue;

      markdown += `### ${category} (${categoryFacts.length})\n\n`;

      for (const f of categoryFacts) {
        const date = f.createdAt ? new Date(f.createdAt).toLocaleDateString() : "N/A";
        markdown += `- ${f.fact}\n`;
        markdown += `  - *Created: ${date}*\n`;
        if (f.relation) {
          markdown += `  - *Relation: ${f.relation}*\n`;
        }
        markdown += `\n`;
      }

      markdown += `---\n\n`;
    }

    // Also create a raw JSON export
    const jsonOutput = {
      userId: KAGAN_USER_ID,
      exportedAt: new Date().toISOString(),
      totalFacts: facts.length,
      facts: facts,
    };

    // Write files
    fs.writeFileSync("kagan-facts.md", markdown);
    fs.writeFileSync("kagan-facts.json", JSON.stringify(jsonOutput, null, 2));

    console.log("Exported to kagan-facts.md and kagan-facts.json");

  } catch (error) {
    console.error("Error:", error);
  }
}

exportFacts();
