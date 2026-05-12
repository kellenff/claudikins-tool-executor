import { describe, expect, it } from "vitest";

import {
  SearchToolsInputSchema,
  GetToolSchemaInputSchema,
  ExecuteCodeInputSchema,
} from "./schemas.js";

describe("schemas", () => {
  it("applies defaults for search tools input", () => {
    const parsed = SearchToolsInputSchema.parse({ query: "diagram" });
    expect(parsed).toMatchObject({
      query: "diagram",
      limit: 5,
      offset: 0,
    });
  });

  it("validates search tools input", () => {
    expect(() => SearchToolsInputSchema.parse({ query: "" })).toThrow();
    expect(() => SearchToolsInputSchema.parse({ query: "ok", limit: 0 })).toThrow();
    expect(() => SearchToolsInputSchema.parse({ query: "ok", limit: 51 })).toThrow();
    expect(() => SearchToolsInputSchema.parse({ query: "ok", limit: 1.5 })).toThrow();
    expect(() => SearchToolsInputSchema.parse({ query: "ok", offset: -1 })).toThrow();
    expect(() => SearchToolsInputSchema.parse({ query: "ok", extra: true })).toThrow();
    expect(SearchToolsInputSchema.parse({ query: "ok", limit: 50, offset: 2 })).toEqual({
      query: "ok",
      limit: 50,
      offset: 2,
    });
    expect(SearchToolsInputSchema.shape.query.description).toBe("Search query for finding relevant tools");
    expect(SearchToolsInputSchema.shape.limit.description).toBe("Maximum results to return (default: 5)");
    expect(SearchToolsInputSchema.shape.offset.description).toBe("Number of results to skip for pagination (default: 0)");
  });

  it("validates get tool schema input", () => {
    expect(() => GetToolSchemaInputSchema.parse({ name: "" })).toThrow();
    expect(() => GetToolSchemaInputSchema.parse({ name: "ok" })).not.toThrow();
    expect(() => GetToolSchemaInputSchema.parse({ name: "ok", extra: true })).toThrow();
    expect(GetToolSchemaInputSchema.shape.name.description).toBe("Tool name (from search_tools results)");
  });

  it("applies defaults and validates execute input", () => {
    const parsed = ExecuteCodeInputSchema.parse({ code: "1 + 1" });
    expect(parsed.timeout).toBe(30000);
    expect(() => ExecuteCodeInputSchema.parse({ code: "" })).toThrow();
    expect(() => ExecuteCodeInputSchema.parse({ code: "1+1", timeout: 10 })).toThrow();
    expect(() => ExecuteCodeInputSchema.parse({ code: "1+1", timeout: 600001 })).toThrow();
    expect(() => ExecuteCodeInputSchema.parse({ code: "1+1", timeout: 1000.5 })).toThrow();
    expect(() => ExecuteCodeInputSchema.parse({ code: "1+1", timeout: 1000, extra: true })).toThrow();
    expect(ExecuteCodeInputSchema.parse({ code: "1+1", timeout: 1000 })).toEqual({
      code: "1+1",
      timeout: 1000,
    });
    expect(ExecuteCodeInputSchema.shape.code.description).toBe("TypeScript/JavaScript code to execute");
    expect(ExecuteCodeInputSchema.shape.timeout.description).toBe("Execution timeout in ms (default: 30000)");
  });
});
