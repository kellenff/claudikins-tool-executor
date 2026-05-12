import { getToolByName } from "../search.js";
import type { GetToolSchemaInput } from "../schemas.js";

/**
 * Get full inputSchema for a specific tool
 */
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
  const tool = await getToolByName(params.name);

  if (!tool) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: `Tool not found: ${params.name}`,
          suggestion: "Use search_tools to find available tools first",
        }),
      }],
      isError: true,
    };
  }

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
