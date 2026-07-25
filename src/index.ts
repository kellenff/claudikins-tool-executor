import dotenv from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// Load .env from module directory (not cwd) for plugin portability
const __dirname = dirname(fileURLToPath(import.meta.url));
// ponytail: quiet:true suppresses dotenv's stdout banner — MCP servers must NOT
// write to stdout (the JSON-RPC channel). One flag, zero behavior change otherwise.
dotenv.config({ path: resolve(__dirname, "..", ".env"), quiet: true });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MAX_LOG_CHARS, MCP_CLIENT_VERSION } from "./constants.js";
import {
  SearchToolsInputSchema,
  GetToolSchemaInputSchema,
  ExecuteCodeInputSchema,
} from "./schemas.js";
import { handleSearchTools, handleGetToolSchema, handleExecuteCode } from "./tools/index.js";
import { startLifecycleManagement } from "./sandbox/clients.js";
import { getAvailableClientNames, getSandboxClientBindings } from "./sandbox/runtime.js";
import { disposeAppRuntime, getAppRuntime } from "./runtime.js";

const server = new McpServer({
  name: "@claudikins/tool-executor",
  version: MCP_CLIENT_VERSION,
});

/** Tool: search_tools Search for MCP tools across all wrapped servers */
server.registerTool(
  "search_tools",
  {
    title: "Search MCP Tools",
    description: `Search for MCP tools across all wrapped servers. Returns slim results (name, server, description, example) for discovery.

Use get_tool_schema(name) to get the full inputSchema when you're ready to call a specific tool.

Available categories: code-nav, graph-analysis, knowledge, ai-models, web, ui, reasoning

Example queries:
- "semantic code search" - Serena code navigation
- "impact analysis" - codebase-memory graph analysis
- "generate diagram" - Gemini image/diagram generation
- "fetch webpage" - HTTP fetch tools`,
    inputSchema: SearchToolsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  handleSearchTools,
);

/** Tool: get_tool_schema Get full inputSchema for a specific tool */
server.registerTool(
  "get_tool_schema",
  {
    title: "Get Tool Schema",
    description: `Get the full inputSchema for a specific tool. Use after search_tools to get parameter details before calling execute_code.

Example: get_tool_schema("gemini-generate-image") - returns full schema with all parameters, types, enums, etc.`,
    inputSchema: GetToolSchemaInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  handleGetToolSchema,
);

/** Tool: execute_code Execute TypeScript/JavaScript code in sandbox */
const clientList = getSandboxClientBindings()
  .map((binding) => `- ${binding}`)
  .join("\n");

server.registerTool(
  "execute_code",
  {
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
    inputSchema: ExecuteCodeInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  handleExecuteCode as unknown as Parameters<typeof server.registerTool>[2],
);

/**
 * Graceful shutdown: dispose the ManagedRuntime so Layers' finalizers run (disconnect MCP clients,
 * clear timers).
 */
let shuttingDown = false;
async function shutdown(message: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.error(message);
  try {
    await disposeAppRuntime();
  } catch (error) {
    console.error("Error during runtime dispose:", error);
  }
  process.exit(0);
}

/** Main entry point */
async function main(): Promise<void> {
  startLifecycleManagement();

  // Build the process-wide ManagedRuntime eagerly so its finalizers are armed before any tool call.
  getAppRuntime();

  // Exit gracefully when client disconnects or we receive a termination signal
  process.stdin.on("close", () => {
    void shutdown("Client disconnected, shutting down");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT, shutting down");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM, shutting down");
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
