import { afterEach, describe, expect, it, vi } from "vitest";

import * as searchModule from "../search.js";
import { handleSearchTools } from "./search.js";
import type { SearchResult } from "../search.js";

describe("tools/search handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps search results to compact MCP output", async () => {
    const sampleResults: SearchResult[] = [
      {
        tool: {
          name: "diagram-generator",
          server: "gemini",
          category: "ui",
          description: "Generate diagrams from prompts.\nSupports mermaid and charts.",
          inputSchema: {},
          example: "gemini.generate",
        },
        score: 1,
      },
    ];

    vi.spyOn(searchModule, "searchTools").mockResolvedValue({
      source: "serena",
      results: sampleResults,
      totalCount: 2,
    });

    const response = await handleSearchTools({ query: "diagram", limit: 1, offset: 0 });
    expect(response.structuredContent).toMatchObject({
      source: "serena",
      count: 1,
      limit: 1,
      offset: 0,
      totalCount: 2,
      has_more: true,
      results: [
        {
          name: "diagram-generator",
          server: "gemini",
          description: "Generate diagrams from prompts.",
        },
      ],
    });
    expect(response.content).toHaveLength(1);
    expect(response.content[0].text).toContain("diagram-generator");
  });

  it("truncates long descriptions and computes pagination metadata", async () => {
    const longDescription = `${"x".repeat(90)}\nsecond line`;
    vi.spyOn(searchModule, "searchTools").mockResolvedValue({
      source: "local",
      results: [
        {
          tool: {
            name: "long-tool",
            server: "gemini",
            category: "ui",
            description: longDescription,
            inputSchema: {},
            example: "gemini.long",
          },
          score: 1,
        },
      ],
      totalCount: 3,
    });

    const response = await handleSearchTools({ query: "long", limit: 1, offset: 1 });

    expect(response.structuredContent.results[0].description).toBe(`${"x".repeat(77)}...`);
    expect(response.structuredContent.has_more).toBe(true);
    expect(JSON.parse(response.content[0].text).results[0].description).toBe(`${"x".repeat(77)}...`);
  });

  it("handles empty descriptions without pagination overflow", async () => {
    vi.spyOn(searchModule, "searchTools").mockResolvedValue({
      source: "local",
      results: [
        {
          tool: {
            name: "empty-description",
            server: "gemini",
            category: "ui",
            description: "",
            inputSchema: {},
            example: "gemini.empty",
          },
          score: 1,
        },
      ],
      totalCount: 1,
    });

    const response = await handleSearchTools({ query: "empty", limit: 5, offset: 0 });

    expect(response.structuredContent.results[0].description).toBe("");
    expect(response.structuredContent.has_more).toBe(false);
  });

  it("exposes fallback fields from local search", async () => {
    vi.spyOn(searchModule, "searchTools").mockResolvedValue({
      source: "local",
      results: [],
      totalCount: 0,
      fallbackReason: "No semantic matches - using text search",
      suggestion: "Try a broader term",
    });

    const response = await handleSearchTools({ query: "none", limit: 3, offset: 0 });

    expect(response.structuredContent).toMatchObject({
      count: 0,
      has_more: false,
      source: "local",
      fallbackReason: "No semantic matches - using text search",
      suggestion: "Try a broader term",
    });
    expect(response.structuredContent.results).toEqual([]);
  });
});
