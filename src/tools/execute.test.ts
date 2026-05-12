import { afterEach, describe, expect, it, vi } from "vitest";

import * as runtime from "../sandbox/runtime.js";
import { handleExecuteCode } from "./execute.js";

describe("tools/execute handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns execution result", async () => {
    vi.spyOn(runtime, "executeCode").mockResolvedValue({
      logs: ["ok", { returned: 1 }],
    });

    const response = await handleExecuteCode({ code: "1 + 1", timeout: 1234 });

    expect(response.isError).toBe(false);
    expect(response.content[0].type).toBe("text");
    expect(response.structuredContent).toEqual({ logs: ["ok", { returned: 1 }] });
    expect(response.content[0].text).toContain("returned");
  });

  it("reflects execution errors", async () => {
    vi.spyOn(runtime, "executeCode").mockResolvedValue({
      logs: [],
      error: "boom",
      stack: "stacktrace",
    });

    const response = await handleExecuteCode({ code: "boom", timeout: 1234 });

    expect(response.isError).toBe(true);
    expect(response.content[0].type).toBe("text");
    expect(response.structuredContent).toMatchObject({
      error: "boom",
      stack: "stacktrace",
      logs: [],
    });
  });
});
