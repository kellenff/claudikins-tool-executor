import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import os from "node:os";

// Resolve plugin install dir relative to module location (not cwd) for plugin portability
const __dirname = dirname(fileURLToPath(import.meta.url));

export const ServerConfigSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  command: z.string().min(1),
  commandEnvKey: z.string().optional(),
  trusted: z.boolean().optional(),
  args: z.array(z.string()),
  env: z.record(z.string(), z.string()).optional(),
});

export const ToolExecutorConfigSchema = z
  .object({
    $schema: z.string().optional(),
    servers: z.array(ServerConfigSchema).min(0),
  })
  .strict();

export type ToolExecutorConfig = z.infer<typeof ToolExecutorConfigSchema>;
export type ServerConfigFromFile = z.infer<typeof ServerConfigSchema>;

/**
 * A server entry tagged with the absolute path of the config layer that supplied it.
 * Used by callers (clients.ts, cli.ts) to report provenance.
 */
export interface LoadedServer extends ServerConfigFromFile {
  source: string;
}

export interface ConfigLoadResult {
  /** Merged server list across all layers; later layers override earlier ones by `name`. */
  servers: LoadedServer[];
  /** Absolute paths of contributing config files, in precedence order (lowest → highest). */
  sources: string[];
}

/**
 * Overrides for the path resolution rules. Defaults read from process / os.
 * Tests inject overrides to avoid touching the real homedir or env.
 */
export interface FindConfigOptions {
  pluginDir?: string;
  cwd?: string;
  homedir?: string;
  xdgConfigHome?: string | null;
  explicitPath?: string | null;
}

const FILENAME = "tool-executor.config.json";

function expandEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName: string) => {
    return process.env[varName] || "";
  });
}

function expandEnvVarsInObject(obj: unknown): unknown {
  if (typeof obj === "string") {
    return expandEnvVars(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(expandEnvVarsInObject);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = expandEnvVarsInObject(value);
    }
    return result;
  }
  return obj;
}

/**
 * Walk the 5 lookup rules in precedence order (lowest → highest):
 *   1. <pluginDir>/tool-executor.config.json
 *   2. <cwd>/tool-executor.config.json
 *   3. <homedir>/.claude/tool-executor/tool-executor.config.json
 *   4. <xdgConfigHome>/tool-executor/tool-executor.config.json (fallback <homedir>/.config/...)
 *   5. $TOOL_EXECUTOR_CONFIG (literal path — no ${VAR} expansion of the path itself)
 *
 * Returns existing files only, deduplicated by absolute path, preserving precedence order.
 * Logs a warning if `$TOOL_EXECUTOR_CONFIG` is set but points to a missing file.
 * All other absent layers are silent.
 */
export function findConfigFiles(opts: FindConfigOptions = {}): string[] {
  const pluginDir = opts.pluginDir ?? resolve(__dirname, "..");
  const cwd = opts.cwd ?? process.cwd();
  const homedir = opts.homedir ?? os.homedir();

  const xdgRaw =
    opts.xdgConfigHome !== undefined
      ? opts.xdgConfigHome
      : process.env.XDG_CONFIG_HOME;
  const xdg =
    xdgRaw && xdgRaw.trim().length > 0
      ? xdgRaw.trim()
      : resolve(homedir, ".config");

  const explicitRaw =
    opts.explicitPath !== undefined
      ? opts.explicitPath
      : process.env.TOOL_EXECUTOR_CONFIG;
  const explicit =
    explicitRaw && explicitRaw.trim().length > 0 ? explicitRaw.trim() : null;

  const candidates: Array<{ path: string; isExplicit: boolean }> = [
    { path: resolve(pluginDir, FILENAME), isExplicit: false },
    { path: resolve(cwd, FILENAME), isExplicit: false },
    {
      path: resolve(homedir, ".claude", "tool-executor", FILENAME),
      isExplicit: false,
    },
    { path: resolve(xdg, "tool-executor", FILENAME), isExplicit: false },
  ];
  if (explicit) {
    candidates.push({ path: resolve(explicit), isExplicit: true });
  }

  const seen = new Set<string>();
  const results: string[] = [];
  for (const { path, isExplicit } of candidates) {
    if (!existsSync(path)) {
      if (isExplicit) {
        console.error(`TOOL_EXECUTOR_CONFIG points to missing file: ${path}`);
      }
      continue;
    }
    if (seen.has(path)) {
      continue;
    }
    seen.add(path);
    results.push(path);
  }
  return results;
}

function parseLayer(path: string): ServerConfigFromFile[] | null {
  try {
    const content = readFileSync(path, "utf-8");
    const parsed = JSON.parse(content);
    const expanded = expandEnvVarsInObject(parsed);
    const validated = ToolExecutorConfigSchema.parse(expanded);
    return validated.servers;
  } catch (error) {
    console.error(`Failed to load config from ${path}:`, error);
    return null;
  }
}

/**
 * Load and merge config from all lookup layers (or from a single explicit path).
 *
 * - With no arguments: walks {@link findConfigFiles} rules and merges all hits.
 * - With `configPath`: loads exactly that file; returns null if it doesn't exist.
 *
 * Merge semantics: later layers (higher precedence) override earlier ones by `name`.
 * Each returned server carries a `source` field pointing to the layer that supplied it.
 *
 * Returns null when no layer contributed any servers (no files found, or every file
 * failed to parse).
 */
export function loadConfig(
  configPath?: string,
  opts?: FindConfigOptions,
): ConfigLoadResult | null {
  let paths: string[];
  if (configPath !== undefined) {
    const resolved = resolve(configPath);
    paths = existsSync(resolved) ? [resolved] : [];
  } else {
    paths = findConfigFiles(opts);
  }
  if (paths.length === 0) return null;

  const byName = new Map<string, LoadedServer>();
  const sources: string[] = [];

  for (const path of paths) {
    const servers = parseLayer(path);
    if (servers === null) continue; // malformed; already logged
    for (const server of servers) {
      byName.set(server.name, { ...server, source: path });
    }
    sources.push(path);
  }

  return sources.length > 0 ? { servers: [...byName.values()], sources } : null;
}
