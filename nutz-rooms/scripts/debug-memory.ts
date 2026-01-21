/**
 * Debug script to test Zep memory
 * Run: npx ts-node scripts/debug-memory.ts [userId]
 */

import { ZepClient } from "@getzep/zep-cloud";

const ZEP_API_KEY = process.env.ZEP_API_KEY;

if (!ZEP_API_KEY) {
  console.error("❌ ZEP_API_KEY not set in environment");
  process.exit(1);
}

const zep = new ZepClient({ apiKey: ZEP_API_KEY });

async function debugMemory() {
  // Test multiple user IDs
  const userIdsToCheck = process.argv[2]
    ? [process.argv[2]]
    : ["test-user", "kagan", "kagan-sumer"];

  for (const testUserId of userIdsToCheck) {

  console.log(`\n🔍 Debugging memory for user: ${testUserId}\n`);
  console.log("=".repeat(50));

  // 1. Check if user exists
  console.log("\n1️⃣ Checking if user exists...");
  try {
    const user = await zep.user.get(testUserId);
    console.log("✅ User found:", user);
  } catch (e) {
    console.log("❌ User not found:", e);
  }

  // 2. Search graph with broad query
  console.log("\n2️⃣ Searching graph (broad query)...");
  try {
    const results = await zep.graph.search({
      userId: testUserId,
      query: "who is this user, what are they building, what is their project",
      limit: 10,
    });
    console.log("✅ Broad search results:");
    console.log("   Edge count:", results?.edges?.length || 0);
    if (results?.edges?.length) {
      results.edges.forEach((edge, i) => {
        console.log(`   [${i + 1}] ${edge.fact?.slice(0, 100)}...`);
      });
    } else {
      console.log("   No facts found");
    }
  } catch (e) {
    console.log("❌ Search failed:", e);
  }

  // 3. Search graph with specific query
  console.log("\n3️⃣ Searching graph (specific: 'hey')...");
  try {
    const results = await zep.graph.search({
      userId: testUserId,
      query: "hey",
      limit: 10,
    });
    console.log("✅ Specific search results:");
    console.log("   Edge count:", results?.edges?.length || 0);
    if (results?.edges?.length) {
      results.edges.forEach((edge, i) => {
        console.log(`   [${i + 1}] ${edge.fact?.slice(0, 100)}...`);
      });
    } else {
      console.log("   No facts found");
    }
  } catch (e) {
    console.log("❌ Search failed:", e);
  }

  // 4. Try adding a test fact
  console.log("\n4️⃣ Adding test fact...");
  try {
    await zep.graph.add({
      userId: testUserId,
      type: "text",
      data: `Test fact added at ${new Date().toISOString()}`,
    });
    console.log("✅ Test fact added");
  } catch (e) {
    console.log("❌ Failed to add fact:", e);
  }

  // 5. Search again to see if new fact appears
  console.log("\n5️⃣ Searching again after adding...");
  try {
    const results = await zep.graph.search({
      userId: testUserId,
      query: "test fact",
      limit: 10,
    });
    console.log("✅ Search after add:");
    console.log("   Edge count:", results?.edges?.length || 0);
    if (results?.edges?.length) {
      results.edges.forEach((edge, i) => {
        console.log(`   [${i + 1}] ${edge.fact?.slice(0, 100)}...`);
      });
    }
  } catch (e) {
    console.log("❌ Search failed:", e);
  }

  // 6. List all users (to see what exists)
  console.log("\n6️⃣ Listing recent users...");
  try {
    // Try to get a few known user patterns
    const patterns = ["user-", "test-", "kagan"];
    for (const pattern of patterns) {
      try {
        const user = await zep.user.get(`${pattern}${Date.now()}`);
        console.log(`   Found user matching ${pattern}:`, user);
      } catch {
        // User doesn't exist, that's fine
      }
    }
  } catch (e) {
    console.log("   Could not list users:", e);
  }

  console.log("\n" + "=".repeat(50));
  } // end for loop

  console.log("Debug complete!\n");
}

debugMemory().catch(console.error);
