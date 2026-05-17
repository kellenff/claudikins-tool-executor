import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadConfig } from "../config.js";
import {
  MCPClients,
  ServerConfig,
  AuditLogEntry,
  ClientState,
} from "../types.js";

type DefaultServerConfig = ServerConfig & {
  envKeys?: string[];
};

const IDLE_TIMEOUT = 3 * 60 * 1000; // 3 minutes

/**
 * Default MCP server configurations.
 *
 * Always merged with user-supplied servers (later layers in the resolved config
 * win by `name`). NOTE: env vars are specified as keys, resolved at connect time
 * (not module load time) so dotenv has loaded before we read process.env.
 */
const DEFAULT_CONFIGS: DefaultServerConfig[] = [
  // NPX servers (Node.js)
  {
    name: "notebooklm",
    displayName: "NotebookLM",
    command: "npx",
    args: ["-y", "notebooklm-mcp"],
  },
  {
    name: "sequentialThinking",
    displayName: "Sequential Thinking",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
  },
  {
    name: "context7",
    displayName: "Context7",
    command: "npx",
    args: ["-y", "@upstash/context7-mcp"],
  },
  {
    name: "gemini",
    displayName: "Gemini",
    command: "npx",
    args: ["-y", "@rlabs-inc/gemini-mcp"],
    envKeys: ["GEMINI_API_KEY"],
  },
  {
    name: "shadcn",
    displayName: "shadcn",
    command: "npx",
    args: ["-y", "shadcn-ui-mcp-server"],
  },
  {
    name: "apify",
    displayName: "Apify",
    command: "npx",
    args: ["-y", "@apify/actors-mcp-server"],
    envKeys: ["APIFY_TOKEN"],
  },
  // Local binaries
  {
    name: "codebase-memory",
    displayName: "Codebase Memory",
    command: "codebase-memory-mcp",
    trusted: true,
    commandEnvKey: "CODEBASE_MEMORY_MCP_BIN",
    args: [],
  },
  // UVX servers (Python)
  {
    name: "serena",
    displayName: "Serena",
    command: "uvx",
    args: [
      "--from",
      "git+https://github.com/oraios/serena",
      "serena",
      "start-mcp-server",
    ],
  },
];

const SAFE_SERVER_COMMANDS = new Set([
  "npx",
  "uvx",
  "node",
  "python",
  "codebase-memory-mcp",
]);

const DEFAULT_SOURCE = "<default>";

/**
 * Resolve optional command env override at runtime (after dotenv loads)
 */
function resolveCommand(config: ServerConfig): string {
  if (!config.commandEnvKey) return config.command;
  return process.env[config.commandEnvKey] || config.command;
}

/**
 * Resolve envKeys to actual env values at runtime (after dotenv loads).
 * Used only for built-in defaults; user-supplied entries use literal `env`.
 */
function resolveEnvKeys(
  envKeys?: string[],
): Record<string, string> | undefined {
  if (!envKeys || envKeys.length === 0) return undefined;

  return envKeys.reduce<Record<string, string>>((acc, key) => {
    acc[key] = process.env[key] || "";
    return acc;
  }, {});
}

/**
 * Validate server commands to avoid accidental command injection from config
 */
function isSafeCommand(config: ServerConfig): boolean {
  const command = config.command;
  if (command === "") return false;
  if (SAFE_SERVER_COMMANDS.has(command)) return true;
  return Boolean(config.trusted);
}

function normalizeServerConfig<T extends ServerConfig>(config: T): T {
  return {
    ...config,
    command: resolveCommand(config),
  };
}

/**
 * Load server configs by always starting from DEFAULT_CONFIGS and overlaying any
 * user-supplied servers (resolved from layered config files) by `name`. User
 * entries replace defaults of the same name; defaults without a user override
 * remain. Unsafe entries are filtered post-merge with a warning that names the
 * provenance source.
 */
function loadServerConfigs(): ServerConfig[] {
  const result = loadConfig();
  const byName = new Map<string, ServerConfig>();

  // Layer A: defaults (with commandEnvKey + envKeys resolved at runtime)
  for (const c of DEFAULT_CONFIGS) {
    const normalized = normalizeServerConfig(c);
    byName.set(c.name, {
      name: normalized.name,
      displayName: normalized.displayName,
      command: normalized.command,
      args: normalized.args,
      env: resolveEnvKeys(c.envKeys),
      trusted: normalized.trusted,
      commandEnvKey: normalized.commandEnvKey,
      source: DEFAULT_SOURCE,
    });
  }

  // Layer B: user entries (commandEnvKey honoured via normalizeServerConfig;
  // env taken literally — ${VAR} was already expanded at parse time).
  if (result) {
    for (const s of result.servers) {
      const normalized = normalizeServerConfig(s);
      byName.set(s.name, {
        name: normalized.name,
        displayName: normalized.displayName,
        command: normalized.command,
        args: normalized.args,
        env: normalized.env,
        trusted: normalized.trusted,
        commandEnvKey: normalized.commandEnvKey,
        source: s.source,
      });
    }
    console.error(
      `Loaded config from ${result.sources.length} source(s): ${result.sources.join(", ")}`,
    );
  } else {
    console.error("No config file found, using default servers");
  }

  return [...byName.values()].filter((server) => {
    if (isSafeCommand(server)) return true;
    console.error(
      `Ignoring server "${server.name}" (from ${server.source ?? "<unknown>"}) because command "${server.command}" is not in the safe command set. Set "trusted: true" to allow explicit command use.`,
    );
    return false;
  });
}

/**
 * MCP server configurations - lazily loaded to ensure dotenv has run first
 */
let _serverConfigs: ServerConfig[] | null = null;

export function getServerConfigs(): ServerConfig[] {
  if (!_serverConfigs) {
    _serverConfigs = loadServerConfigs();
  }
  return _serverConfigs;
}

// For backwards compatibility - proxy that lazily loads configs
export const SERVER_CONFIGS = new Proxy([] as ServerConfig[], {
  get(_, prop) {
    const configs = getServerConfigs();
    const value = (configs as any)[prop];
    // Bind methods to the actual configs array
    if (typeof value === "function") {
      return value.bind(configs);
    }
    return value;
  },
});

/**
 * Client state tracking for lazy loading and lifecycle management
 */
const clientStates = new Map<string, ClientState>();

/**
 * Track in-flight connection promises to avoid duplicate connections
 */
const connectionPromises = new Map<string, Promise<Client | null>>();

/**
 * Audit log for all MCP calls
 */
const auditLog: AuditLogEntry[] = [];

/**
 * Initialize client states (all disconnected)
 */
export function initClientStates(): void {
  for (const config of SERVER_CONFIGS) {
    clientStates.set(config.name, {
      client: null,
      lastUsed: 0,
      connecting: false,
    });
  }
}

/**
 * Get a client, connecting lazily if needed
 */
export async function getClient(name: string): Promise<Client | null> {
  const state = clientStates.get(name);
  if (!state) {
    console.error(`Unknown client: ${name}`);
    return null;
  }

  // Already connected
  if (state.client) {
    state.lastUsed = Date.now();
    return state.client;
  }

  // Connection already in progress - wait for it
  const existingPromise = connectionPromises.get(name);
  if (existingPromise) {
    return existingPromise;
  }

  // Start new connection
  const connectionPromise = connectClientInternal(name, state);
  connectionPromises.set(name, connectionPromise);

  try {
    return await connectionPromise;
  } finally {
    connectionPromises.delete(name);
  }
}

/**
 * Internal connection logic
 */
async function connectClientInternal(
  name: string,
  state: ClientState,
): Promise<Client | null> {
  const config = SERVER_CONFIGS.find((c) => c.name === name);
  if (!config) {
    return null;
  }

  try {
    const client = new Client(
      { name: `claudikins-${name}`, version: "1.1.0" },
      { capabilities: {} },
    );
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: { ...process.env, ...config.env } as Record<string, string>,
    });

    await client.connect(transport);

    state.client = client;
    state.lastUsed = Date.now();
    console.error(`Connected: ${config.displayName}`);
    return client;
  } catch (error) {
    console.error(`Failed to connect ${config.displayName}:`, error);
    return null;
  }
}

/**
 * Disconnect a specific client
 */
export async function disconnectClient(name: string): Promise<void> {
  const state = clientStates.get(name);
  if (!state?.client) return;

  try {
    await state.client.close();
    console.error(`Disconnected: ${name}`);
  } catch (error) {
    console.error(`Error disconnecting ${name}:`, error);
  }

  state.client = null;
  state.lastUsed = 0;
}

/**
 * Disconnect all clients
 */
export async function disconnectAll(): Promise<void> {
  const names = Array.from(clientStates.keys());
  await Promise.all(names.map(disconnectClient));
}

/**
 * Clean up idle clients (run periodically)
 */
export async function cleanupIdleClients(): Promise<void> {
  const now = Date.now();
  for (const [name, state] of clientStates) {
    if (state.client && now - state.lastUsed > IDLE_TIMEOUT) {
      await disconnectClient(name);
    }
  }
}

/**
 * Get list of currently connected clients
 */
export function getConnectedClients(): string[] {
  const connected: string[] = [];
  for (const [name, state] of clientStates) {
    if (state.client) {
      connected.push(name);
    }
  }
  return connected;
}

/**
 * Get list of all available clients (connected or not)
 */
export function getAvailableClients(): string[] {
  return SERVER_CONFIGS.map((c) => c.name);
}

/**
 * Log an MCP call for auditing
 */
export function logMcpCall(entry: AuditLogEntry): void {
  auditLog.push(entry);

  // Keep only last 1000 entries
  if (auditLog.length > 1000) {
    auditLog.shift();
  }
}

/**
 * Get recent audit log entries
 */
export function getAuditLog(limit = 100): AuditLogEntry[] {
  return auditLog.slice(-limit);
}

/**
 * Start the idle cleanup interval
 */
let cleanupInterval: NodeJS.Timeout | null = null;

export function startLifecycleManagement(): void {
  if (cleanupInterval) return;

  // Initialize client states (deferred to ensure dotenv has loaded)
  initClientStates();

  // Check for idle clients every minute
  cleanupInterval = setInterval(cleanupIdleClients, 60_000);

  // Clean shutdown handlers
  const shutdown = async (): Promise<void> => {
    console.error("Shutting down...");
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
    await disconnectAll();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

/**
 * Stop lifecycle management (for testing)
 */
export function stopLifecycleManagement(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Client states initialized lazily in startLifecycleManagement()

export const DEFAULT_SOURCE_TAG = DEFAULT_SOURCE;
