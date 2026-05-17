#!/usr/bin/env npx tsx
/**
 * Quick integration test - verify MCP client connections work
 */
import "dotenv/config";
import { disconnectAll, getClient, initClientStates } from "../src/sandbox/clients.js";

async function testClient(name: string): Promise<boolean> {
  console.log(`\nTesting ${name}...`);
  const client = await getClient(name);

  if (client) {
    const tools = await client.listTools();
    console.log(`✅ ${name} connected! Tools: ${tools.tools?.length || 0}`);
    return true;
  } else {
    console.log(`❌ ${name} failed to connect`);
    return false;
  }
}

async function main(): Promise<void> {
  initClientStates();

  await testClient("context7");
  await testClient("gemini");

  await disconnectAll();
  console.log("\nDone.");
}

main().catch(console.error);
