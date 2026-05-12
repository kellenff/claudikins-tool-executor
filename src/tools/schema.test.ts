import { afterEach, describe, expect, it, vi } from "vitest";

import * as searchModule from "../search.js";
import { handleGetToolSchema } from "./schema.js";

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
