import { afterEach, describe, expect, it, beforeEach } from "vitest";
import {
  initBM25,
  isBM25Ready,
  resetBM25,
  searchBM25,
} from "./bm25.js";
import type { ToolDefinition } from "./types.js";

describe("bm25", () => {
  const tools: ToolDefinition[] = [
    {
      name: "search-code",
      server: "serena",
      category: "code-nav",
      description: "Search codebase with graph-based analysis",
      inputSchema: {},
      example: "serena.search_code",
    },
    {
      name: "generate-diagram",
      server: "gemini",
      category: "ui",
      description: "Generate diagrams from code or prompts",
      inputSchema: {},
      example: "gemini.generate_diagram",
    },
    {
      name: "search-docs",
      server: "notebooklm",
      category: "knowledge",
      description: "Search documentation and notes",
      inputSchema: {},
      example: "notebooklm.search-docs",
    },
  ];

  beforeEach(() => {
    resetBM25();
  });

  afterEach(() => {
    resetBM25();
  });

  it("tracks initialization state", () => {
    expect(isBM25Ready()).toBe(false);
    initBM25(tools);
    expect(isBM25Ready()).toBe(true);
  });

  it("finds matches for seeded tools", () => {
    initBM25(tools);
    const results = searchBM25("generate diagram", 5);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toEqual(tools[1]);
  });

  it("returns empty results before initialization", () => {
    expect(searchBM25("anything", 3)).toEqual([]);
  });

  it("returns empty results after reset", () => {
    initBM25(tools);
    expect(isBM25Ready()).toBe(true);

    resetBM25();
    expect(isBM25Ready()).toBe(false);
    expect(searchBM25("diagram", 2)).toEqual([]);
  });
});
