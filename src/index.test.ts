import { afterEach, describe, expect, it, vi } from "vitest";

const registerEffectTools = vi.fn();
const mcpServerConstructor = vi.fn();
const startLifecycleManagement = vi.fn();
const getAvailableClientNames = vi.fn().mockReturnValue(["serena", "gemini"]);
const getSandboxClientBindings = vi.fn().mockReturnValue(["serena", "gemini"]);
const connect = vi.fn().mockResolvedValue(undefined);
const dotenvConfig = vi.fn();
const stdioConstructor = vi.fn();

vi.mock("dotenv", () => ({
  default: {
    config: dotenvConfig,
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class {
    connect = connect;

    constructor(options: unknown) {
      mcpServerConstructor(options);
      return { connect };
    }
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", async () => {
  const actual = await vi.importActual("@modelcontextprotocol/sdk/server/stdio.js");
  return {
    ...(actual as Record<string, unknown>),
    StdioServerTransport: class {
      type = "stdio-transport";
      constructor() {
        stdioConstructor();
      }
    },
  };
});

vi.mock("./schemas.js", () => ({
  SearchToolsInputSchema: {},
  GetToolSchemaInputSchema: {},
  ExecuteCodeInputSchema: {},
  parseSearchToolsInput: vi.fn(),
  parseGetToolSchemaInput: vi.fn(),
  parseExecuteCodeInput: vi.fn(),
}));

vi.mock("./register-tools.js", () => ({
  registerEffectTools,
}));

vi.mock("./tools/index.js", () => ({
  handleSearchTools: vi.fn(),
  handleGetToolSchema: vi.fn(),
  handleExecuteCode: vi.fn(),
}));

vi.mock("./sandbox/clients.js", () => ({
  startLifecycleManagement,
}));

vi.mock("./sandbox/runtime.js", () => ({
  getAvailableClientNames,
  getSandboxClientBindings,
}));

describe("index", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    registerEffectTools.mockReset();
    mcpServerConstructor.mockReset();
    startLifecycleManagement.mockReset();
    getAvailableClientNames.mockReset().mockReturnValue(["serena", "gemini"]);
    getSandboxClientBindings.mockReset().mockReturnValue(["serena", "gemini"]);
    connect.mockReset().mockResolvedValue(undefined);
    dotenvConfig.mockReset();
    stdioConstructor.mockReset();
  });

  it("registers tools and starts server bootstrap on module load", async () => {
    const stdinOnSpy = vi.spyOn(process.stdin, "on").mockImplementation(() => process.stdin);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await import("./index.js");

    expect(dotenvConfig).toHaveBeenCalledWith({
      path: expect.stringContaining(".env"),
    });
    expect(mcpServerConstructor).toHaveBeenCalledWith({
      name: "@claudikins/tool-executor",
      version: "1.1.0",
    });
    expect(startLifecycleManagement).toHaveBeenCalledTimes(1);
    expect(getAvailableClientNames).toHaveBeenCalledTimes(1);
    expect(getSandboxClientBindings).toHaveBeenCalledTimes(1);
    expect(registerEffectTools).toHaveBeenCalledTimes(1);

    const registrations = registerEffectTools.mock.calls[0]?.[1] as Array<{
      name: string;
      title: string;
      description: string;
      annotations: Record<string, boolean>;
    }>;
    const toolNames = registrations.map((tool) => tool.name);
    expect(toolNames).toEqual(["search_tools", "get_tool_schema", "execute_code"]);
    expect(registrations[0]).toMatchObject({
      title: "Search MCP Tools",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    });
    expect(registrations[1]).toMatchObject({
      title: "Get Tool Schema",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    });

    const executeTool = registrations[2];
    expect(executeTool).toMatchObject({
      title: "Execute Code",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    });
    expect(executeTool?.description).toContain("Available MCP clients");
    expect(executeTool?.description).toContain("- serena");
    expect(executeTool?.description).toContain("- gemini");
    expect(executeTool?.description).toContain(
      "Results are summarised if console.log output exceeds",
    );

    expect(stdioConstructor).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(stdinOnSpy).toHaveBeenCalledWith("close", expect.any(Function));

    const closeHandler = stdinOnSpy.mock.calls.find(
      (call) => (call[0] as string) === "close",
    )?.[1] as () => void;
    closeHandler();
    expect(consoleErrorSpy).toHaveBeenCalledWith("Client disconnected, shutting down");
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Claudikins Tool Executor running");
    expect(consoleErrorSpy).toHaveBeenCalledWith("Available MCP clients: serena, gemini");
  });

  it("reports fatal bootstrap errors", async () => {
    vi.spyOn(process.stdin, "on").mockImplementation(() => process.stdin);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("connect failed");
    connect.mockRejectedValueOnce(error);

    await import("./index.js");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(consoleErrorSpy).toHaveBeenCalledWith("Fatal error:", error);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
