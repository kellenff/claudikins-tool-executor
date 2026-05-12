import { getClient, logMcpCall, SERVER_CONFIGS } from "./clients.js";
import { workspace } from "./workspace.js";
import { MAX_LOG_CHARS, MAX_LOG_ENTRY_CHARS, MCP_RESULTS_DIR } from "../constants.js";
import { ExecutionResult } from "../types.js";

const DEFAULT_TIMEOUT = 30_000; // 30 seconds

type ClientProxy = Record<string, (args?: Record<string, unknown>) => Promise<unknown>>;
type MockConsole = {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};
type SandboxGlobals = Record<string, unknown> & {
  console: MockConsole;
  workspace: typeof workspace;
  clients: Record<string, ClientProxy>;
};

/**
 * Summarise logs aggressively to minimize context usage
 */
function summariseLogs(logs: unknown[]): unknown[] {
  if (logs.length === 0) return [];

  const serialised = JSON.stringify(logs);
  if (serialised.length <= MAX_LOG_CHARS) {
    return logs;
  }

  // Ultra-minimal summary - just confirmation + size
  return [`Output truncated (${serialised.length} chars). Check workspace for full results.`];
}

/**
 * Create a proxy that wraps an MCP client's tool calls
 * Large responses are auto-saved to workspace, returning references
 */
function createClientProxy(name: string): ClientProxy {
  return new Proxy({} as ClientProxy, {
    get(_, toolName) {
      if (toolName === "then") {
        return undefined;
      }

      if (typeof toolName !== "string") {
        return undefined;
      }

      return async (args: Record<string, unknown> = {}) => {
        const client = await getClient(name);
        if (!client) {
          throw new Error(`${name} MCP is not available`);
        }

        const startTime = Date.now();
        try {
          const result = await client.callTool({ name: toolName, arguments: args });

          logMcpCall({
            timestamp: startTime,
            client: name,
            tool: toolName,
            args,
            duration: Date.now() - startTime,
          });

          // Check response size
          const serialised = JSON.stringify(result);
          if (serialised.length > MAX_LOG_ENTRY_CHARS) {
            // Auto-save large responses to workspace
            const filename = `${Date.now()}-${name}-${toolName}.json`;
            const filepath = `${MCP_RESULTS_DIR}/${filename}`;
            try {
              await workspace.mkdir(MCP_RESULTS_DIR);
              await workspace.writeJSON(filepath, result);

              // Return reference with preview
              return {
                _savedTo: filepath,
                _size: serialised.length,
                _preview: serialised.slice(0, 200) + "...",
                _hint: `Full result saved to workspace. Use workspace.readJSON("${filepath}") to access.`,
              };
            } catch (saveErr) {
              // If save fails, return truncated result with warning
              console.error(`Failed to auto-save large result: ${saveErr}`);
              return {
                _warning: "Result too large to auto-save, returning truncated",
                _size: serialised.length,
                _preview: serialised.slice(0, 1000),
              };
            }
          }

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logMcpCall({
            timestamp: startTime,
            client: name,
            tool: toolName,
            args,
            duration: Date.now() - startTime,
            error: errorMessage,
          });
          throw error;
        }
      };
    },
  });
}

/**
 * Convert arbitrary MCP server names into JavaScript-safe sandbox bindings.
 */
function toSandboxIdentifier(name: string): string {
  const identifier = name.replace(/[^a-zA-Z0-9_$]/g, "_") || "_";
  return /^[0-9]/.test(identifier) ? `_${identifier}` : identifier;
}

const RESERVED_IDENTIFIERS = new Set([
  "await",
  "break",
  "case",
  "class",
  "catch",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "arguments",
  "eval",
]);

const RESERVED_GLOBAL_BINDINGS = new Set(["console", "workspace", "clients", "globalThis"]);

function toGlobalIdentifier(name: string, usedIdentifiers: Set<string>): string {
  let identifier = toSandboxIdentifier(name);
  if (RESERVED_IDENTIFIERS.has(identifier)) {
    identifier = `_${identifier}`;
  }
  if (RESERVED_GLOBAL_BINDINGS.has(identifier)) {
    identifier = `${identifier}_`;
  }

  let candidate = identifier;
  let i = 1;
  while (usedIdentifiers.has(candidate)) {
    candidate = `${identifier}_${i++}`;
  }
  return candidate;
}

/**
 * Map server names to guaranteed-usable sandbox bindings.
 */
function buildServerBindingMap(): Map<string, string> {
  const bindings = new Map<string, string>();
  const used = new Set(["console", "workspace", "clients", "globalThis"]);

  for (const config of SERVER_CONFIGS) {
    const identifier = toGlobalIdentifier(config.name, used);
    used.add(identifier);
    bindings.set(config.name, identifier);
  }

  return bindings;
}

/**
 * Create a mock console that captures output
 */
function createMockConsole(): { console: MockConsole; logs: unknown[] } {
  const logs: unknown[] = [];
  const mockConsole = {
    log: (...args: unknown[]) => { logs.push(args.length === 1 ? args[0] : args); },
    info: (...args: unknown[]) => { logs.push({ level: "info", data: args }); },
    warn: (...args: unknown[]) => { logs.push({ level: "warn", data: args }); },
    error: (...args: unknown[]) => { logs.push({ level: "error", data: args }); },
    debug: (...args: unknown[]) => { logs.push({ level: "debug", data: args }); },
  };
  return { console: mockConsole, logs };
}

/**
 * Build the sandbox globals object with all MCP clients and workspace
 */
function buildSandboxGlobals(mockConsole: MockConsole): SandboxGlobals {
  const bindingMap = buildServerBindingMap();
  const clients: Record<string, ClientProxy> = {};
  const globals: SandboxGlobals = {
    console: mockConsole,
    workspace,
    clients,
  };

  // Add all MCP client proxies
  for (const config of SERVER_CONFIGS) {
    const proxy = createClientProxy(config.name);
    clients[config.name] = proxy;
    const identifier = bindingMap.get(config.name) || toSandboxIdentifier(config.name);
    if (!Object.prototype.hasOwnProperty.call(globals, identifier)) {
      globals[identifier] = proxy;
    }
  }

  return globals;
}

/**
 * Execute TypeScript/JavaScript code in a sandboxed environment
 */
export async function executeCode(code: string, timeout = DEFAULT_TIMEOUT): Promise<ExecutionResult> {
  const { console: mockConsole, logs } = createMockConsole();
  const globals = buildSandboxGlobals(mockConsole);

  // Build the async function with injected globals
  const globalNames = Object.keys(globals);
  const globalValues = Object.values(globals);

  try {
    // Create async function with globals as parameters
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;
    const fn = new AsyncFunction(...globalNames, code);

    // Execute with timeout
    const result = await Promise.race([
      fn(...globalValues),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Execution timed out after ${timeout}ms`)), timeout)),
    ]);

    // If the code returned something, add it to logs
    if (result !== undefined) {
      logs.push({ returned: result });
    }

    return { logs: summariseLogs(logs) };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    return {
      logs: summariseLogs(logs),
      error: errorMessage,
      stack,
    };
  }
}

/**
 * Get a list of available MCP clients (for error messages)
 */
export function getAvailableClientNames(): string[] {
  return SERVER_CONFIGS.map((c) => c.name);
}

/**
 * Get available MCP client bindings as exposed inside execute_code.
 */
export function getSandboxClientBindings(): string[] {
  return SERVER_CONFIGS.map((c) => {
    const identifier = buildServerBindingMap().get(c.name) || toSandboxIdentifier(c.name);
    return identifier === c.name ? c.name : `${identifier} (server: ${c.name})`;
  });
}
