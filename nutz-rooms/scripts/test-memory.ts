// Quick memory test script
// Run with: npx ts-node scripts/test-memory.ts

export {}; // Make this a module to avoid global scope conflicts

const BASE_URL = "https://nutz-rooms.vercel.app";

async function testMemory() {
  // Generate fresh user ID (simpler format)
  const userId = `test-${Date.now()}`;

  console.log("\n========================================");
  console.log("MEMORY TEST");
  console.log("========================================");
  console.log(`User ID: ${userId}\n`);

  // Test 1: Fresh user says "hey"
  console.log("TEST 1: Fresh user says 'hey'");
  console.log("Expected: Generic greeting (yo, hey, whats up)");
  console.log("---");

  const res1 = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "hey", userId }),
  });
  const data1 = await res1.json();
  console.log(`Response: "${data1.response}"`);
  console.log("");

  // Test 2: User shares what they're working on
  console.log("TEST 2: User shares project");
  console.log("Input: 'im building a freelancer invoice app'");
  console.log("---");

  const res2 = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "im building a freelancer invoice app",
      userId,
    }),
  });
  const data2 = await res2.json();
  console.log(`Response: "${data2.response}"`);
  console.log("");

  // Wait for memory to save and index in Zep (takes ~10s to index)
  console.log("(Waiting 12s for Zep to index...)");
  await new Promise(r => setTimeout(r, 12000));

  // Test 3: Check debug endpoint for saved memory
  console.log("TEST 3: Check if memory was saved");
  console.log("---");

  const debugRes = await fetch(`${BASE_URL}/api/debug/memory?userId=${userId}&query=freelancer`);
  const debugData = await debugRes.json();
  console.log(`User memories found: ${debugData.userMemory?.count || 0}`);
  if (debugData.userMemory?.memories?.length > 0) {
    console.log(`Memory: "${debugData.userMemory.memories[0]}"`);
  }
  console.log("");

  // Test 4: New conversation, same user says "hey"
  console.log("TEST 4: RETURNING user says 'hey' (new thread)");
  console.log("Expected: Should mention freelancer/invoice naturally");
  console.log("---");

  const res4 = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "hey",
      userId,
      // No threadId = new conversation
    }),
  });
  const data4 = await res4.json();
  console.log(`Response: "${data4.response}"`);

  // Quick check
  const mentionsProject = data4.response.toLowerCase().includes("freelancer") ||
                          data4.response.toLowerCase().includes("invoice") ||
                          data4.response.toLowerCase().includes("app");
  console.log("");
  console.log(`✓ Mentions project: ${mentionsProject ? "YES ✅" : "NO ❌"}`);

  console.log("\n========================================");
  console.log("TEST COMPLETE");
  console.log("========================================\n");
}

testMemory().catch(console.error);
