import { describe, expect, it } from "vitest";

import { MAX_LOG_CHARS, MAX_LOG_ENTRY_CHARS, MCP_RESULTS_DIR } from "./constants.js";

describe("constants", () => {
  it("uses expected logging limits", () => {
    expect(MAX_LOG_CHARS).toBe(500);
    expect(MAX_LOG_ENTRY_CHARS).toBe(200);
  });

  it("uses expected workspace output directory", () => {
    expect(MCP_RESULTS_DIR).toBe("mcp-results");
  });
});
