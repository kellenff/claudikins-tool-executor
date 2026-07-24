import { afterEach, describe, expect, it, vi } from "vitest";

import * as searchModule from "../search.js";
import { errorToolSchemaResponse, handleGetToolSchema, toToolSchemaResponse } from "./schema.js";
import type { ToolDefinition } from "../types.js";

const makeTool = (overrides: Partial<ToolDefinition> = {}): ToolDefinition => ({
  name: "diagram-generator",
  server: "gemini",
  category: "ui",
  description: "Generate diagrams from code",
  inputSchema: { type: "object" },
  example: "gemini.generate-diagram",
  ...overrides,
});

describe("tools/schema handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns tool schema when tool exists", async () => {
    vi.spyOn(searchModule, "getToolByName").mockResolvedValue({
      name: "diagram-generator",
      server: "gemini",
      category: "ui",
      description: "Generate diagrams from code",
      inputSchema: { type: "object", properties: {} },
      example: "gemini.generate-diagram",
      notes: "Supports mermaid",
    });

    const response = await handleGetToolSchema({ name: "diagram-generator" });
    const parsed = JSON.parse(response.content[0].text);

    expect(response.isError).toBeUndefined();
    expect(response.structuredContent).toMatchObject({
      name: "diagram-generator",
      server: "gemini",
      description: "Generate diagrams from code",
      example: "gemini.generate-diagram",
      inputSchema: { type: "object", properties: {} },
      notes: "Supports mermaid",
    });
    expect(response.content[0].type).toBe("text");
    expect(response.content).toHaveLength(1);
    expect(parsed.notes).toBe("Supports mermaid");
  });

  it("returns an error for missing tools", async () => {
    vi.spyOn(searchModule, "getToolByName").mockResolvedValue(null);

    const response = await handleGetToolSchema({ name: "missing-tool" });

    expect(response.isError).toBe(true);
    expect(response.content).toHaveLength(1);
    expect(response.content[0].type).toBe("text");
    expect(JSON.parse(response.content[0].text)).toEqual({
      error: "Tool not found: missing-tool",
      suggestion: "Use search_tools to find available tools first",
    });
  });
});

describe("toToolSchemaResponse", () => {
  it("builds a success response with structured content from the tool", () => {
    const response = toToolSchemaResponse(makeTool({ notes: "Supports mermaid" }));

    expect(response.structuredContent).toEqual({
      name: "diagram-generator",
      server: "gemini",
      description: "Generate diagrams from code",
      inputSchema: { type: "object" },
      example: "gemini.generate-diagram",
      notes: "Supports mermaid",
    });
    expect(response.isError).toBeUndefined();
    expect(response.content).toEqual([
      { type: "text", text: JSON.stringify(response.structuredContent, null, 2) },
    ]);
  });

  it("returns undefined notes when the source tool has no notes", () => {
    const response = toToolSchemaResponse(makeTool());

    expect(response.structuredContent.notes).toBeUndefined();
  });
});

describe("errorToolSchemaResponse", () => {
  it("builds an error response with isError=true", () => {
    const response = errorToolSchemaResponse("missing-tool");

    expect(response.isError).toBe(true);
    expect(response.structuredContent).toBeUndefined();
    expect(response.content).toHaveLength(1);
    expect(response.content[0]?.type).toBe("text");
  });

  it("includes the requested tool name in the error message", () => {
    const response = errorToolSchemaResponse("specific-tool-name");
    const parsed = JSON.parse(response.content[0]?.text ?? "{}");

    expect(parsed.error).toBe("Tool not found: specific-tool-name");
  });

  it("includes a search_tools suggestion", () => {
    const response = errorToolSchemaResponse("anything");
    const parsed = JSON.parse(response.content[0]?.text ?? "{}");

    expect(parsed.suggestion).toBe("Use search_tools to find available tools first");
  });
});
