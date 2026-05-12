import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    loadConfig: vi.fn(),
    connect: vi.fn(),
    close: vi.fn(),
    callTool: vi.fn(),
    clientInstances: [] as Array<{ instance: unknown; info: unknown; options: unknown }>,
    transportOptions: [] as unknown[],
    Client: vi.fn(),
    StdioClientTransport: vi.fn(),
  };

  state.Client = vi.fn(function (this: unknown, info: unknown, options: unknown) {
    const instance = {
      connect: state.connect,
      close: state.close,
      callTool: state.callTool,
    };
    state.clientInstances.push({ instance, info, options });
    return instance;
  });

  state.StdioClientTransport = vi.fn(function (this: unknown, options: unknown) {
    state.transportOptions.push(options);
    return { options };
  });

  return state;
});

vi.mock("../config.js", () => ({
  loadConfig: mocks.loadConfig,
}));

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: mocks.Client,
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: mocks.StdioClientTransport,
}));

async function importClients() {
  vi.resetModules();
  return import("./clients.js");
}

describe("sandbox clients", () => {
  const originalEnv = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    APIFY_TOKEN: process.env.APIFY_TOKEN,
    CODEBASE_MEMORY_MCP_BIN: process.env.CODEBASE_MEMORY_MCP_BIN,
    TOOL_EXECUTOR_TEST_BIN: process.env.TOOL_EXECUTOR_TEST_BIN,
  };

  beforeEach(() => {
    mocks.loadConfig.mockReset();
    mocks.connect.mockReset().mockResolvedValue(undefined);
    mocks.close.mockReset().mockResolvedValue(undefined);
    mocks.callTool.mockReset();
    mocks.Client.mockClear();
    mocks.StdioClientTransport.mockClear();
    mocks.clientInstances.length = 0;
    mocks.transportOptions.length = 0;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("loads explicit config, resolves command overrides, and filters unsafe commands", async () => {
    process.env.TOOL_EXECUTOR_TEST_BIN = "custom-bin";
    mocks.loadConfig.mockReturnValue({
      servers: [
        { name: "safe", displayName: "Safe", command: "npx", args: ["pkg"], env: { TOKEN: "x" } },
        { name: "empty", displayName: "Empty", command: "", args: [] },
        { name: "unsafe", displayName: "Unsafe", command: "curl", args: ["http://example.test"] },
        { name: "trusted", displayName: "Trusted", command: "custom-tool", args: ["--ok"], trusted: true },
        {
          name: "override",
          displayName: "Override",
          command: "node",
          commandEnvKey: "TOOL_EXECUTOR_TEST_BIN",
          args: ["server.js"],
          trusted: true,
        },
      ],
    });

    const { getServerConfigs, SERVER_CONFIGS } = await importClients();
    const configs = getServerConfigs();

    expect(configs.map((config) => config.name)).toEqual(["safe", "trusted", "override"]);
    expect(configs[0]).toEqual({
      name: "safe",
      displayName: "Safe",
      command: "npx",
      args: ["pkg"],
      env: { TOKEN: "x" },
    });
    expect(configs[2]).toMatchObject({
      name: "override",
      command: "custom-bin",
      args: ["server.js"],
    });
    expect(SERVER_CONFIGS.map((config) => config.displayName)).toEqual(["Safe", "Trusted", "Override"]);
    expect(console.error).toHaveBeenCalledWith("Loaded config with 5 servers");
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Ignoring server "empty"'));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Ignoring server "unsafe"'));
  });

  it("falls back to default configs and resolves default env keys at runtime", async () => {
    delete process.env.GEMINI_API_KEY;
    process.env.APIFY_TOKEN = "apify-secret";
    process.env.CODEBASE_MEMORY_MCP_BIN = "/opt/bin/codebase-memory-mcp";
    mocks.loadConfig.mockReturnValue(null);

    const { getServerConfigs } = await importClients();
    const configs = getServerConfigs();

    expect(configs).toEqual([
      {
        name: "notebooklm",
        displayName: "NotebookLM",
        command: "npx",
        args: ["-y", "notebooklm-mcp"],
        env: undefined,
      },
      {
        name: "sequentialThinking",
        displayName: "Sequential Thinking",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
        env: undefined,
      },
      {
        name: "context7",
        displayName: "Context7",
        command: "npx",
        args: ["-y", "@upstash/context7-mcp"],
        env: undefined,
      },
      {
        name: "gemini",
        displayName: "Gemini",
        command: "npx",
        args: ["-y", "@rlabs-inc/gemini-mcp"],
        env: { GEMINI_API_KEY: "" },
      },
      {
        name: "shadcn",
        displayName: "shadcn",
        command: "npx",
        args: ["-y", "shadcn-ui-mcp-server"],
        env: undefined,
      },
      {
        name: "apify",
        displayName: "Apify",
        command: "npx",
        args: ["-y", "@apify/actors-mcp-server"],
        env: { APIFY_TOKEN: "apify-secret" },
      },
      {
        name: "codebase-memory",
        displayName: "Codebase Memory",
        command: "/opt/bin/codebase-memory-mcp",
        args: [],
        env: undefined,
      },
      {
        name: "serena",
        displayName: "Serena",
        command: "uvx",
        args: ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server"],
        env: undefined,
      },
    ]);
    expect(console.error).toHaveBeenCalledWith("No config file found, using default servers");
  });

  it("connects, reuses, and disconnects clients", async () => {
    mocks.loadConfig.mockReturnValue({
      servers: [
        { name: "safe", displayName: "Safe", command: "node", args: ["server.js"], env: { LOCAL_ENV: "value" } },
      ],
    });

    const clients = await importClients();
    clients.initClientStates();

    const client = await clients.getClient("safe");
    const reused = await clients.getClient("safe");

    expect(client).toBe(mocks.clientInstances[0].instance);
    expect(reused).toBe(client);
    expect(mocks.Client).toHaveBeenCalledTimes(1);
    expect(mocks.Client).toHaveBeenCalledWith({ name: "claudikins-safe", version: "1.1.0" }, { capabilities: {} });
    expect(mocks.StdioClientTransport).toHaveBeenCalledWith(expect.objectContaining({
      command: "node",
      args: ["server.js"],
      env: expect.objectContaining({ LOCAL_ENV: "value" }),
    }));
    expect(clients.getAvailableClients()).toEqual(["safe"]);
    expect(clients.getConnectedClients()).toEqual(["safe"]);

    await clients.disconnectClient("safe");

    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(clients.getConnectedClients()).toEqual([]);

    mocks.close.mockRejectedValueOnce(new Error("close failed"));
    await clients.getClient("safe");
    await clients.disconnectClient("safe");
    expect(console.error).toHaveBeenCalledWith("Error disconnecting safe:", expect.any(Error));
  });

  it("returns null for unknown or failed clients", async () => {
    mocks.loadConfig.mockReturnValue({
      servers: [
        { name: "safe", displayName: "Safe", command: "node", args: [] },
      ],
    });

    const clients = await importClients();
    clients.initClientStates();
    await expect(clients.getClient("missing")).resolves.toBeNull();

    mocks.connect.mockRejectedValueOnce(new Error("connect failed"));
    await expect(clients.getClient("safe")).resolves.toBeNull();

    expect(clients.getConnectedClients()).toEqual([]);
    expect(console.error).toHaveBeenCalledWith("Unknown client: missing");
    expect(console.error).toHaveBeenCalledWith("Failed to connect Safe:", expect.any(Error));
  });

  it("deduplicates concurrent connection attempts", async () => {
    mocks.loadConfig.mockReturnValue({
      servers: [
        { name: "safe", displayName: "Safe", command: "node", args: [] },
      ],
    });
    let releaseConnect!: () => void;
    mocks.connect.mockReturnValueOnce(new Promise<void>((resolve) => {
      releaseConnect = resolve;
    }));

    const clients = await importClients();
    clients.initClientStates();
    const first = clients.getClient("safe");
    const second = clients.getClient("safe");
    releaseConnect();

    await expect(Promise.all([first, second])).resolves.toEqual([
      mocks.clientInstances[0].instance,
      mocks.clientInstances[0].instance,
    ]);
    expect(mocks.Client).toHaveBeenCalledTimes(1);
  });

  it("disconnects all connected clients", async () => {
    mocks.loadConfig.mockReturnValue({
      servers: [
        { name: "first", displayName: "First", command: "node", args: [] },
        { name: "second", displayName: "Second", command: "node", args: [] },
      ],
    });

    const clients = await importClients();
    clients.initClientStates();
    await clients.getClient("first");
    await clients.getClient("second");
    expect(clients.getConnectedClients()).toEqual(["first", "second"]);

    await clients.disconnectAll();

    expect(mocks.close).toHaveBeenCalledTimes(2);
    expect(clients.getConnectedClients()).toEqual([]);
  });

  it("cleans up idle clients and keeps bounded audit history", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    mocks.loadConfig.mockReturnValue({
      servers: [
        { name: "safe", displayName: "Safe", command: "node", args: [] },
      ],
    });

    const clients = await importClients();
    clients.initClientStates();
    await clients.getClient("safe");

    vi.setSystemTime(3 * 60 * 1000);
    await clients.cleanupIdleClients();
    expect(mocks.close).toHaveBeenCalledTimes(0);

    vi.setSystemTime((3 * 60 * 1000) + 1);
    await clients.cleanupIdleClients();
    expect(mocks.close).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 1005; i++) {
      clients.logMcpCall({ timestamp: i, client: "safe", tool: "lookup", args: { i } });
    }

    const allEntries = clients.getAuditLog(2000);
    expect(allEntries).toHaveLength(1000);
    expect(allEntries[0].timestamp).toBe(5);
    expect(clients.getAuditLog(2).map((entry) => entry.timestamp)).toEqual([1003, 1004]);
  });

  it("starts and stops lifecycle management once", async () => {
    vi.useFakeTimers();
    mocks.loadConfig.mockReturnValue({
      servers: [
        { name: "safe", displayName: "Safe", command: "node", args: [] },
      ],
    });
    const processOn = vi.spyOn(process, "on").mockImplementation(() => process);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const clients = await importClients();
    clients.startLifecycleManagement();
    clients.startLifecycleManagement();

    expect(processOn).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(processOn).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(clients.getAvailableClients()).toEqual(["safe"]);

    clients.stopLifecycleManagement();
    clients.startLifecycleManagement();
    expect(processOn).toHaveBeenCalledTimes(4);

    const shutdown = processOn.mock.calls.find((call) => call[0] === "SIGINT")?.[1] as () => Promise<void>;
    await shutdown();
    expect(console.error).toHaveBeenCalledWith("Shutting down...");
    expect(exitSpy).toHaveBeenCalledWith(0);
    clients.stopLifecycleManagement();
  });
});
