import dotenv from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// Load .env from module directory (not cwd) for plugin portability
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MAX_LOG_CHARS, MCP_CLIENT_VERSION } from "./constants.js";
import {
  SearchToolsInputSchema,
  GetToolSchemaInputSchema,
  ExecuteCodeInputSchema,
  parseSearchToolsInput,
  parseGetToolSchemaInput,
  parseExecuteCodeInput,
} from "./schemas.js";
import { handleSearchTools, handleGetToolSchema, handleExecuteCode } from "./tools/index.js";
import { registerEffectTools, type AnyEffectToolRegistration } from "./register-tools.js";
import { startLifecycleManagement } from "./sandbox/clients.js";
import { getAvailableClientNames, getSandboxClientBindings } from "./sandbox/runtime.js";

const server = new McpServer({
  name: "@claudikins/tool-executor",
  version: MCP_CLIENT_VERSION,
});

const clientList = getSandboxClientBindings()
  .map((binding) => `- ${binding}`)
  .join("\n");

registerEffectTools(server, [
  {
    name: "search_tools",
    title: "Search MCP Tools",
    description: `Search for MCP tools across all wrapped servers. Returns slim results (name, server, description, example) for discovery.

Use get_tool_schema(name) to get the full inputSchema when you're ready to call a specific tool.

Available categories: code-nav, graph-analysis, knowledge, ai-models, web, ui, reasoning

Example queries:
- "semantic code search" - Serena code navigation
- "impact analysis" - codebase-memory graph analysis
- "generate diagram" - Gemini image/diagram generation
- "fetch webpage" - HTTP fetch tools`,
    schema: SearchToolsInputSchema,
    parse: parseSearchToolsInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: handleSearchTools as AnyEffectToolRegistration["handler"],
  },
  {
    name: "get_tool_schema",
    title: "Get Tool Schema",
    description: `Get the full inputSchema for a specific tool. Use after search_tools to get parameter details before calling execute_code.

Example: get_tool_schema("gemini-generate-image") - returns full schema with all parameters, types, enums, etc.`,
    schema: GetToolSchemaInputSchema,
    parse: parseGetToolSchemaInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: handleGetToolSchema as AnyEffectToolRegistration["handler"],
  },
  {
    name: "execute_code",
    title: "Execute Code",
    description: `Execute TypeScript/JavaScript code with access to MCP clients and workspace.

**WORKFLOW** (follow this order):
1. Use search_tools("your query") to find relevant tools
2. Use get_tool_schema("tool_name") to get full parameters
3. Use execute_code to run your code with the discovered tools

If you don't know which tool to use, ALWAYS search first.

**IMPORTANT: Context-Efficient Pattern**
MCP tool responses are auto-saved to workspace when large. Your code receives a reference:
\`\`\`typescript
const result = await gemini["gemini-generate-image"]({...});
// If large: { _savedTo: "mcp-results/123.json", _preview: "..." }
// Read full result: await workspace.readJSON(result._savedTo)
\`\`\`

**Available MCP clients:**
${clientList}
Hyphenated server names are exposed as safe identifiers, e.g. codebase_memory for server codebase-memory.
All clients are also available by original server name through clients["server-name"].

**Workspace API:**
- workspace.write(path, data) / workspace.read(path)
- workspace.writeJSON(path, obj) / workspace.readJSON(path)
- workspace.list(path) / workspace.exists(path)

**Best Practice:** Save outputs to workspace, return minimal confirmation:
\`\`\`typescript
await workspace.writeJSON("analysis.json", results);
console.log("Saved analysis.json");  // Minimal context cost
\`\`\`

Results are summarised if console.log output exceeds ${MAX_LOG_CHARS} chars.`,
    schema: ExecuteCodeInputSchema,
    parse: parseExecuteCodeInput,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    handler: handleExecuteCode as AnyEffectToolRegistration["handler"],
  },
]);

/** Main entry point */
async function main(): Promise<void> {
  startLifecycleManagement();

  // Exit gracefully when client disconnects (prevents orphan processes)
  process.stdin.on("close", () => {
    console.error("Client disconnected, shutting down");
    process.exit(0);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Claudikins Tool Executor running");
  console.error(`Available MCP clients: ${getAvailableClientNames().join(", ")}`);
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
