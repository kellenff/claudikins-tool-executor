import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import { Schema } from "effect";

export type EffectToolRegistration<Input = unknown> = {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly annotations?: ToolAnnotations;
  readonly schema: Parameters<typeof Schema.toJsonSchemaDocument>[0];
  readonly parse: (input: unknown) => Input;
  readonly handler: (input: Input) => CallToolResult | Promise<CallToolResult>;
};

/** Heterogeneous tool table entry (widened for mixed input types). */
export type AnyEffectToolRegistration = {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly annotations?: ToolAnnotations;
  readonly schema: Parameters<typeof Schema.toJsonSchemaDocument>[0];
  readonly parse: (input: unknown) => unknown;
  readonly handler: (input: unknown) => CallToolResult | Promise<CallToolResult>;
};

export function toolInputJsonSchema(
  schema: EffectToolRegistration["schema"],
): Record<string, unknown> {
  const doc = Schema.toJsonSchemaDocument(schema, {
    additionalProperties: false,
  });
  return doc.schema as Record<string, unknown>;
}

export function buildToolsList<Input>(
  registrations: ReadonlyArray<EffectToolRegistration<Input>>,
): {
  tools: Array<{
    name: string;
    title?: string;
    description?: string;
    inputSchema: Record<string, unknown>;
    annotations?: ToolAnnotations;
  }>;
} {
  return {
    tools: registrations.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: toolInputJsonSchema(tool.schema),
      annotations: tool.annotations,
    })),
  };
}

function parseToolArguments(tool: AnyEffectToolRegistration, args: unknown): unknown {
  try {
    return tool.parse(args ?? {});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new McpError(ErrorCode.InvalidParams, `Input validation error: ${message}`);
  }
}

function createToolHandlerError(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

async function invokeRegisteredTool(
  tool: AnyEffectToolRegistration,
  args: unknown,
): Promise<CallToolResult> {
  const parsed = parseToolArguments(tool, args);
  try {
    return await tool.handler(parsed);
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    return createToolHandlerError(message);
  }
}

/**
 * Test helper mirroring the live `tools/call` path: parse failures throw `McpError(InvalidParams)`;
 * handler failures return `{ isError: true }` (same as `McpServer.createToolError`).
 */
export async function callRegisteredTool<Input>(
  registrations: ReadonlyArray<EffectToolRegistration<Input>>,
  name: string,
  args: unknown,
): Promise<CallToolResult> {
  const tool = registrations.find((entry) => entry.name === name);
  if (!tool) {
    throw new McpError(ErrorCode.InvalidParams, `Tool ${name} not found`);
  }
  return invokeRegisteredTool(tool as AnyEffectToolRegistration, args);
}

/**
 * Register tools on the underlying MCP `Server` without Zod / `registerTool`. Must be called before
 * any `registerTool` usage (we never call `registerTool`).
 */
export function registerEffectTools(
  mcp: McpServer,
  registrations: ReadonlyArray<AnyEffectToolRegistration>,
): void {
  const byName = new Map(registrations.map((tool) => [tool.name, tool]));

  mcp.server.registerCapabilities({
    tools: { listChanged: true },
  });

  mcp.server.setRequestHandler(ListToolsRequestSchema, () => buildToolsList(registrations));

  mcp.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const tool = byName.get(name);
    if (!tool) {
      throw new McpError(ErrorCode.InvalidParams, `Tool ${name} not found`);
    }
    return invokeRegisteredTool(tool, request.params.arguments);
  });
}
