import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import {
  ExecuteCodeInputSchema,
  GetToolSchemaInputSchema,
  parseExecuteCodeInput,
  parseGetToolSchemaInput,
  parseSearchToolsInput,
  SearchToolsInputSchema,
} from "./schemas.js";

function fieldDescription(schema: unknown, field: string): string | undefined {
  const doc = Schema.toJsonSchemaDocument(
    schema as Parameters<typeof Schema.toJsonSchemaDocument>[0],
  );
  const properties = doc.schema.properties as Record<string, Record<string, unknown>> | undefined;
  const fieldSchema = properties?.[field];
  if (!fieldSchema) {
    return undefined;
  }

  if (typeof fieldSchema.description === "string") {
    return fieldSchema.description;
  }

  const allOf = fieldSchema.allOf as Array<{ description?: string }> | undefined;
  if (typeof allOf?.[0]?.description === "string") {
    return allOf[0].description;
  }

  const anyOf = fieldSchema.anyOf as Array<Record<string, unknown>> | undefined;
  const firstAnyOf = anyOf?.[0];
  if (firstAnyOf) {
    if (typeof firstAnyOf.description === "string") {
      return firstAnyOf.description;
    }
    const nestedAllOf = firstAnyOf.allOf as Array<{ description?: string }> | undefined;
    if (typeof nestedAllOf?.[0]?.description === "string") {
      return nestedAllOf[0].description;
    }
  }

  return undefined;
}

describe("schemas", () => {
  it("applies defaults for search tools input", () => {
    const parsed = parseSearchToolsInput({ query: "diagram" });
    expect(parsed).toMatchObject({
      query: "diagram",
      limit: 5,
      offset: 0,
    });
  });

  it("validates search tools input", () => {
    expect(() => parseSearchToolsInput({ query: "" })).toThrow();
    expect(() => parseSearchToolsInput({ query: "ok", limit: 0 })).toThrow();
    expect(() => parseSearchToolsInput({ query: "ok", limit: 51 })).toThrow();
    expect(() => parseSearchToolsInput({ query: "ok", limit: 1.5 })).toThrow();
    expect(() => parseSearchToolsInput({ query: "ok", offset: -1 })).toThrow();
    expect(() => parseSearchToolsInput({ query: "ok", extra: true })).toThrow();
    expect(parseSearchToolsInput({ query: "ok", limit: 50, offset: 2 })).toEqual({
      query: "ok",
      limit: 50,
      offset: 2,
    });
    expect(fieldDescription(SearchToolsInputSchema, "query")).toBe(
      "Search query for finding relevant tools",
    );
    expect(fieldDescription(SearchToolsInputSchema, "limit")).toBe(
      "Maximum results to return (default: 5)",
    );
    expect(fieldDescription(SearchToolsInputSchema, "offset")).toBe(
      "Number of results to skip for pagination (default: 0)",
    );
  });

  it("validates get tool schema input", () => {
    expect(() => parseGetToolSchemaInput({ name: "" })).toThrow();
    expect(() => parseGetToolSchemaInput({ name: "ok" })).not.toThrow();
    expect(() => parseGetToolSchemaInput({ name: "ok", extra: true })).toThrow();
    expect(fieldDescription(GetToolSchemaInputSchema, "name")).toBe(
      "Tool name (from search_tools results)",
    );
  });

  it("applies defaults and validates execute input", () => {
    const parsed = parseExecuteCodeInput({ code: "1 + 1" });
    expect(parsed.timeout).toBe(30000);
    expect(() => parseExecuteCodeInput({ code: "" })).toThrow();
    expect(() => parseExecuteCodeInput({ code: "1+1", timeout: 10 })).toThrow();
    expect(() => parseExecuteCodeInput({ code: "1+1", timeout: 600001 })).toThrow();
    expect(() => parseExecuteCodeInput({ code: "1+1", timeout: 1000.5 })).toThrow();
    expect(() => parseExecuteCodeInput({ code: "1+1", timeout: 1000, extra: true })).toThrow();
    expect(parseExecuteCodeInput({ code: "1+1", timeout: 1000 })).toEqual({
      code: "1+1",
      timeout: 1000,
    });
    expect(fieldDescription(ExecuteCodeInputSchema, "code")).toBe(
      "TypeScript/JavaScript code to execute",
    );
    expect(fieldDescription(ExecuteCodeInputSchema, "timeout")).toBe(
      "Execution timeout in ms (default: 30000)",
    );
  });
});
