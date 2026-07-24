import { Effect } from "effect";

import { getToolByName } from "../search.js";
import { getAppRuntime } from "../runtime.js";
import type { GetToolSchemaInput } from "../schemas.js";
import type { ToolDefinition } from "../types.js";

/**
 * Build the success response when a tool was found. Pure: derives everything from `tool`. The
 * structuredContent mirrors the YAML fields plus `example` and optional `notes`.
 */
export function toToolSchemaResponse(tool: ToolDefinition): {
  content: { type: "text"; text: string }[];
  structuredContent: {
    name: string;
    server: string;
    description: string;
    inputSchema: object;
    example: string;
    notes: string | undefined;
  };
  isError?: undefined;
} {
  const output = {
    name: tool.name,
    server: tool.server,
    description: tool.description,
    inputSchema: tool.inputSchema,
    example: tool.example,
    notes: tool.notes,
  };
  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    structuredContent: output,
  };
}

/**
 * Build the error response when a tool was not found. Pure: the requested name is woven into the
 * error message and `search_tools` is suggested as the discovery path.
 */
export function errorToolSchemaResponse(name: string): {
  content: { type: "text"; text: string }[];
  isError: boolean;
  structuredContent?: undefined;
} {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          error: `Tool not found: ${name}`,
          suggestion: "Use search_tools to find available tools first",
        }),
      },
    ],
    isError: true,
  };
}

type GetToolSchemaResult =
  | ReturnType<typeof errorToolSchemaResponse>
  | ReturnType<typeof toToolSchemaResponse>;

export const getToolSchemaEffect = (
  params: GetToolSchemaInput,
): Effect.Effect<GetToolSchemaResult, unknown> =>
  Effect.gen(function* () {
    const tool = yield* Effect.tryPromise({
      try: () => getToolByName(params.name),
      catch: (cause) => cause,
    });

    if (!tool) {
      return errorToolSchemaResponse(params.name);
    }

    return toToolSchemaResponse(tool);
  });

/** Get full inputSchema for a specific tool */
export async function handleGetToolSchema(params: GetToolSchemaInput): Promise<
  | {
      content: { type: "text"; text: string }[];
      isError: boolean;
      structuredContent?: undefined;
    }
  | {
      content: { type: "text"; text: string }[];
      structuredContent: {
        name: string;
        server: string;
        description: string;
        inputSchema: object;
        example: string;
        notes: string | undefined;
      };
      isError?: undefined;
    }
> {
  return getAppRuntime().runPromise(getToolSchemaEffect(params));
}
