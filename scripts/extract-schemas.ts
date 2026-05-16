#!/usr/bin/env tsx
/**
 * Extract tool schemas from live MCP servers and generate YAML registry files
 *
 * Usage: npm run extract
 */

import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";

/**
 * Server configuration with category mapping
 */
interface ServerConfig {
  name: string;
  displayName: string;
  command: string;
  args: string[];
  category: string;
  env?: Record<string, string>;
}
const MCP_CLIENT_VERSION = "1.1.0";

const SERVERS: ServerConfig[] = [
  // NPX servers (Node.js)
  {
    name: "notebooklm",
    displayName: "NotebookLM",
    command: "npx",
    args: ["-y", "notebooklm-mcp"],
    category: "knowledge",
  },
  {
    name: "sequentialThinking",
    displayName: "Sequential Thinking",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    category: "reasoning",
  },
  {
    name: "context7",
    displayName: "Context7",
    command: "npx",
    args: ["-y", "@upstash/context7-mcp"],
    category: "knowledge",
  },
  {
    name: "gemini",
    displayName: "Gemini",
    command: "npx",
    args: ["-y", "@rlabs-inc/gemini-mcp"],
    category: "ai-models",
    env: { GEMINI_API_KEY: process.env.GEMINI_API_KEY || "" },
  },
  {
    name: "shadcn",
    displayName: "shadcn",
    command: "npx",
    args: ["-y", "shadcn-ui-mcp-server"],
    category: "ui",
  },
  {
    name: "apify",
    displayName: "Apify",
    command: "npx",
    args: ["-y", "@apify/actors-mcp-server"],
    category: "web",
    env: { APIFY_TOKEN: process.env.APIFY_TOKEN || "" },
  },

  // UVX servers (Python)
  {
    name: "serena",
    displayName: "Serena",
    command: "uvx",
    args: [
      "--from",
      "git+https://github.com/oraios/serena",
      "serena",
      "start-mcp-server",
    ],
    category: "code-nav",
  },

  // Local binaries (override path via env var if installed elsewhere)
  {
    name: "codebase-memory",
    displayName: "Codebase Memory",
    command: process.env.CODEBASE_MEMORY_MCP_BIN || "codebase-memory-mcp",
    args: [],
    category: "graph-analysis",
  },
];

const REGISTRY_ROOT = join(process.cwd(), "registry");
const RESERVED_IDENTIFIERS = new Set([
  "await",
  "break",
  "case",
  "class",
  "catch",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "arguments",
  "eval",
]);
const RESERVED_GLOBAL_BINDINGS = new Set([
  "console",
  "workspace",
  "clients",
  "globalThis",
]);
const SERVER_BINDINGS = new Map<string, string>();
const usedBindings = new Set<string>([
  "console",
  "workspace",
  "clients",
  "globalThis",
]);

/**
 * Connect to an MCP server and extract tool schemas
 */
async function extractFromServer(config: ServerConfig): Promise<void> {
  console.log(`\nConnecting to ${config.displayName}...`);

  const client = new Client(
    { name: "schema-extractor", version: MCP_CLIENT_VERSION },
    { capabilities: {} },
  );

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: { ...process.env, ...config.env } as Record<string, string>,
  });

  try {
    await client.connect(transport);
    console.log(`  Connected to ${config.displayName}`);

    // Get tool list
    const response = await client.listTools();
    const tools = response.tools || [];

    console.log(`  Found ${tools.length} tools`);

    if (tools.length === 0) {
      await client.close();
      return;
    }

    // Create category/server directory
    const serverDir = join(REGISTRY_ROOT, config.category, config.name);
    await mkdir(serverDir, { recursive: true });

    // Write each tool to YAML
    for (const tool of tools) {
      const toolDef = {
        name: tool.name,
        server: config.name,
        category: config.category,
        description: tool.description || "No description provided",
        inputSchema: tool.inputSchema || { type: "object", properties: {} },
        example: generateExample(config.name, tool.name, tool.inputSchema),
      };

      const yamlContent = yaml.dump(toolDef, {
        lineWidth: 120,
        noRefs: true,
      });

      const filePath = join(serverDir, `${sanitizeFilename(tool.name)}.yaml`);
      await writeFile(filePath, yamlContent, "utf-8");
      console.log(`    Wrote ${tool.name}`);
    }

    await client.close();
    console.log(`  Disconnected from ${config.displayName}`);
  } catch (error) {
    console.error(
      `  Failed to extract from ${config.displayName}:`,
      error instanceof Error ? error.message : error,
    );
    try {
      await client.close();
    } catch {
      // Ignore close errors
    }
  }
}

/**
 * Generate a basic example for a tool
 */
function generateExample(
  serverName: string,
  toolName: string,
  inputSchema: unknown,
): string {
  const schema = inputSchema as {
    properties?: Record<string, { type?: string; description?: string }>;
  };
  const props = schema?.properties || {};
  const propNames = Object.keys(props);
  const serverBinding = getServerBinding(serverName);

  if (propNames.length === 0) {
    return `await ${serverBinding}["${toolName}"]({});`;
  }

  const args = propNames
    .slice(0, 3) // Limit to first 3 properties for brevity
    .map((name) => {
      const prop = props[name];
      const placeholder = getPlaceholder(prop?.type, name);
      return `  ${toObjectKey(name)}: ${placeholder}`;
    })
    .join(",\n");

  return `await ${serverBinding}["${toolName}"]({\n${args}\n});`;
}

/**
 * Match execute_code sandbox bindings for server names that are not valid JS identifiers.
 */
function toSandboxIdentifier(serverName: string): string {
  const identifier = serverName.replace(/[^a-zA-Z0-9_$]/g, "_") || "_";
  return /^[0-9]/.test(identifier) ? `_${identifier}` : identifier;
}

function getServerBinding(serverName: string): string {
  const existing = SERVER_BINDINGS.get(serverName);
  if (existing) {
    return existing;
  }

  let binding = toSandboxIdentifier(serverName);
  if (RESERVED_IDENTIFIERS.has(binding)) {
    binding = `_${binding}`;
  }
  if (RESERVED_GLOBAL_BINDINGS.has(binding)) {
    binding = `${binding}_`;
  }

  let candidate = binding;
  let suffix = 1;
  while (usedBindings.has(candidate)) {
    candidate = `${binding}_${suffix++}`;
  }

  usedBindings.add(candidate);
  SERVER_BINDINGS.set(serverName, candidate);
  return candidate;
}

/**
 * Quote input object keys only when JavaScript requires it.
 */
function toObjectKey(name: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

/**
 * Get a placeholder value for a property type
 */
function getPlaceholder(type: string | undefined, name: string): string {
  switch (type) {
    case "string":
      return `"<${name}>"`;
    case "number":
    case "integer":
      return "0";
    case "boolean":
      return "true";
    case "array":
      return "[]";
    case "object":
      return "{}";
    default:
      return `"<${name}>"`;
  }
}

/**
 * Sanitize a tool name for use as a filename
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log("Tool Schema Extractor");
  console.log("=====================");
  console.log(`Registry root: ${REGISTRY_ROOT}`);

  // Process servers sequentially to avoid overwhelming the system
  for (const server of SERVERS) {
    await extractFromServer(server);
  }

  console.log("\nDone!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
