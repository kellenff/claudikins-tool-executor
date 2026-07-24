import { afterEach, describe, expect, it, vi } from "vitest";

import * as searchModule from "../search.js";
import { handleSearchTools, oneLiner, toSearchToolsResponse } from "./search.js";
import type { SearchResponse, SearchResult } from "../search.js";
import type { ToolDefinition } from "../types.js";
import type { SearchToolsInput } from "../schemas.js";
import { MAX_ONE_LINER_CHARS } from "../constants.js";

const makeTool = (overrides: Partial<ToolDefinition> = {}): ToolDefinition => ({
  name: "demo-tool",
  server: "demo",
  category: "demo",
  description: "default description",
  inputSchema: {},
  example: "",
  ...overrides,
});

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
    expect(JSON.parse(response.content[0].text).results[0].description).toBe(
      `${"x".repeat(77)}...`,
    );
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

describe("oneLiner", () => {
  it("returns empty string for empty input", () => {
    expect(oneLiner("")).toBe("");
  });

  it("takes only the first line", () => {
    expect(oneLiner("first\nsecond\nthird")).toBe("first");
  });

  it("trims whitespace from the first line", () => {
    expect(oneLiner("  trimmed  \nsecond")).toBe("trimmed");
  });

  it("truncates long single-line input with ellipsis", () => {
    const longText = "x".repeat(MAX_ONE_LINER_CHARS + 20);
    const result = oneLiner(longText);

    expect(result.endsWith("...")).toBe(true);
    expect(result.length).toBe(MAX_ONE_LINER_CHARS);
  });

  it("returns short input unchanged", () => {
    const short = "x".repeat(10);
    expect(oneLiner(short)).toBe(short);
  });
});

describe("toSearchToolsResponse", () => {
  const baseParams: SearchToolsInput = { query: "foo", limit: 5, offset: 0 };

  it("returns an empty result list when the search yields none", () => {
    const response: SearchResponse = { source: "serena", results: [], totalCount: 0 };
    const output = toSearchToolsResponse(baseParams, response);

    expect(output.results).toEqual([]);
    expect(output.count).toBe(0);
    expect(output.has_more).toBe(false);
  });

  it("maps result descriptions through oneLiner", () => {
    const response: SearchResponse = {
      source: "serena",
      results: [
        {
          tool: makeTool({ description: "First sentence only.\nSecond sentence ignored." }),
          score: 1,
        },
      ],
      totalCount: 1,
    };
    const output = toSearchToolsResponse(baseParams, response);

    expect(output.results[0]?.description).toBe("First sentence only.");
  });

  it("computes has_more when offset + count is below totalCount", () => {
    const response: SearchResponse = {
      source: "serena",
      results: [{ tool: makeTool(), score: 1 }],
      totalCount: 3,
    };
    const params: SearchToolsInput = { query: "foo", limit: 1, offset: 0 };
    const output = toSearchToolsResponse(params, response);

    expect(output.has_more).toBe(true);
  });

  it("treats undefined totalCount as having no more results", () => {
    const response: SearchResponse = {
      source: "local",
      results: [{ tool: makeTool(), score: 1 }],
      totalCount: undefined,
    };
    const output = toSearchToolsResponse(baseParams, response);

    expect(output.has_more).toBe(false);
  });

  it("includes fallbackReason and suggestion when present", () => {
    const response: SearchResponse = {
      source: "local",
      results: [],
      totalCount: 0,
      fallbackReason: "Serena unavailable",
      suggestion: "Try broader terms",
    };
    const output = toSearchToolsResponse(baseParams, response);

    expect(output.fallbackReason).toBe("Serena unavailable");
    expect(output.suggestion).toBe("Try broader terms");
  });

  it("omits fallbackReason and suggestion when not present", () => {
    const response: SearchResponse = { source: "serena", results: [], totalCount: 0 };
    const output = toSearchToolsResponse(baseParams, response);

    expect(output.fallbackReason).toBeUndefined();
    expect(output.suggestion).toBeUndefined();
  });
});
