import { afterEach, describe, expect, it, vi } from "vitest";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => ({
  getClient: vi.fn(),
  logMcpCall: vi.fn(),
}));

vi.mock("./clients.js", () => ({
  SERVER_CONFIGS: [
    { name: "code-nav", displayName: "Code Nav", command: "node", args: [] },
    { name: "class", displayName: "Class", command: "node", args: [] },
    { name: "console", displayName: "Console", command: "node", args: [] },
    { name: "1start", displayName: "Numbered", command: "node", args: [] },
    { name: "code_nav", displayName: "Code Nav Duplicate", command: "node", args: [] },
  ],
  getClient: mocks.getClient,
  logMcpCall: mocks.logMcpCall,
}));

import {
  executeCode,
  getAvailableClientNames,
  getSandboxClientBindings,
} from "./runtime.js";
import { workspace } from "./workspace.js";

describe("sandbox runtime client bindings", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mocks.getClient.mockReset();
    mocks.logMcpCall.mockReset();
    rmSync(resolve("workspace", "mcp-results"), { recursive: true, force: true });
  });

  it("exposes original client names and JavaScript-safe bindings", () => {
    expect(getAvailableClientNames()).toEqual(["code-nav", "class", "console", "1start", "code_nav"]);
    expect(getSandboxClientBindings()).toEqual([
      "code_nav (server: code-nav)",
      "_class (server: class)",
      "console_ (server: console)",
      "_1start (server: 1start)",
      "code_nav_1 (server: code_nav)",
    ]);
  });

  it("calls MCP tools through client proxies and logs audit entries", async () => {
    const callTool = vi.fn().mockResolvedValue({ ok: true });
    mocks.getClient.mockResolvedValue({ callTool });

    const result = await executeCode('return await clients["code-nav"].lookup({ q: "diagram" });');

    expect(result.error).toBeUndefined();
    expect(result.logs).toContainEqual({ returned: { ok: true } });
    expect(callTool).toHaveBeenCalledWith({ name: "lookup", arguments: { q: "diagram" } });
    expect(mocks.logMcpCall).toHaveBeenCalledWith(expect.objectContaining({
      client: "code-nav",
      tool: "lookup",
      args: { q: "diagram" },
      duration: expect.any(Number),
    }));
  });

  it("reports unavailable MCP clients as execution errors", async () => {
    mocks.getClient.mockResolvedValue(null);

    const result = await executeCode("return await code_nav.lookup();");

    expect(result.error).toBe("code-nav MCP is not available");
    expect(mocks.logMcpCall).not.toHaveBeenCalled();
  });

  it("auto-saves large MCP responses to workspace", async () => {
    const payload = { data: "x".repeat(250) };
    const callTool = vi.fn().mockResolvedValue(payload);
    mocks.getClient.mockResolvedValue({ callTool });

    const result = await executeCode('return await clients["code-nav"].large();');
    const returned = (result.logs[0] as { returned: { _savedTo: string; _size: number; _preview: string } }).returned;

    expect(returned._savedTo).toMatch(/^mcp-results\/\d+-code-nav-large\.json$/);
    expect(returned._size).toBeGreaterThan(200);
    expect(returned._preview.endsWith("...")).toBe(true);
    await expect(workspace.readJSON(returned._savedTo)).resolves.toEqual(payload);
  });

  it("returns a truncated warning when auto-save fails", async () => {
    const payload = { data: "x".repeat(250) };
    const callTool = vi.fn().mockResolvedValue(payload);
    mocks.getClient.mockResolvedValue({ callTool });
    vi.spyOn(workspace, "writeJSON").mockRejectedValueOnce(new Error("disk full"));

    const result = await executeCode('return await clients["code-nav"].large();');
    const returned = (result.logs[0] as { returned: { _warning: string; _size: number; _preview: string } }).returned;

    expect(returned).toMatchObject({
      _warning: "Result too large to auto-save, returning truncated",
      _size: expect.any(Number),
      _preview: expect.any(String),
    });
    expect(returned._preview.length).toBeLessThanOrEqual(1000);
  });
});
