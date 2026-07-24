import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import {
  buildToolsList,
  callRegisteredTool,
  type EffectToolRegistration,
} from "./register-tools.js";
import { parseSearchToolsInput, type SearchToolsInput, SearchToolsInputSchema } from "./schemas.js";

describe("register-tools", () => {
  const searchReg: EffectToolRegistration<SearchToolsInput> = {
    name: "search_tools",
    title: "Search MCP Tools",
    description: "Search tools",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    schema: SearchToolsInputSchema,
    parse: parseSearchToolsInput,
    handler: async (input) => ({
      content: [{ type: "text", text: JSON.stringify(input) }],
    }),
  };

  it("lists JSON Schema derived from Effect Schema", () => {
    const { tools } = buildToolsList([searchReg]);
    expect(tools).toHaveLength(1);
    const tool = tools[0];
    expect(tool.name).toBe("search_tools");
    expect(tool.inputSchema).toMatchObject({
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for finding relevant tools",
        },
      },
      required: expect.arrayContaining(["query"]),
    });
    expect(tool.annotations).toEqual(searchReg.annotations);
  });

  it("rejects invalid tool arguments before calling the handler", async () => {
    await expect(callRegisteredTool([searchReg], "search_tools", { query: "" })).rejects.toThrow(
      /validation|Invalid|empty|Query/i,
    );
  });

  it("invokes handler with decoded args", async () => {
    const result = await callRegisteredTool([searchReg], "search_tools", {
      query: "diagram",
    });
    expect(result.isError).not.toBe(true);
    const text = result.content[0];
    expect(text.type).toBe("text");
    if (text.type === "text") {
      expect(JSON.parse(text.text)).toMatchObject({
        query: "diagram",
        limit: 5,
        offset: 0,
      });
    }
  });

  it("round-trips Schema.toJsonSchemaDocument for search schema", () => {
    const doc = Schema.toJsonSchemaDocument(SearchToolsInputSchema, {
      additionalProperties: false,
    });
    expect(doc.schema.type).toBe("object");
    expect(doc.schema.additionalProperties).toBe(false);
  });
});
