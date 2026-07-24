import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import os from "node:os";

import { Schema } from "effect";

// Resolve plugin install dir relative to module location (not cwd) for plugin portability
const __dirname = dirname(fileURLToPath(import.meta.url));

const STRICT = { onExcessProperty: "error" as const };

export const ServerConfigSchema = Schema.Struct({
  name: Schema.String.check(Schema.isNonEmpty()),
  displayName: Schema.String.check(Schema.isNonEmpty()),
  command: Schema.String.check(Schema.isNonEmpty()),
  commandEnvKey: Schema.optional(Schema.String),
  trusted: Schema.optional(Schema.Boolean),
  args: Schema.Array(Schema.String),
  env: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});

export const ToolExecutorConfigSchema = Schema.Struct({
  $schema: Schema.optional(Schema.String),
  servers: Schema.Array(ServerConfigSchema),
});

export type ServerConfigFromFile = {
  name: string;
  displayName: string;
  command: string;
  commandEnvKey?: string;
  trusted?: boolean;
  args: string[];
  env?: Record<string, string>;
};

export type ToolExecutorConfig = {
  $schema?: string;
  servers: ServerConfigFromFile[];
};

export function parseServerConfig(input: unknown): ServerConfigFromFile {
  return Schema.decodeUnknownSync(ServerConfigSchema)(input) as ServerConfigFromFile;
}

export function parseToolExecutorConfig(input: unknown): ToolExecutorConfig {
  return Schema.decodeUnknownSync(ToolExecutorConfigSchema, STRICT)(input) as ToolExecutorConfig;
}

/**
 * A server entry tagged with the absolute path of the config layer that supplied it. Used by
 * callers (clients.ts, cli.ts) to report provenance.
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
 * Overrides for the path resolution rules. Defaults read from process / os. Tests inject overrides
 * to avoid touching the real homedir or env.
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

interface ResolvedCandidate {
  readonly path: string;
  readonly isExplicit: boolean;
  readonly exists: boolean;
}

/**
 * Pure dedupe by absolute path. Returns the preserved-order existing paths plus the first
 * explicit-but-missing path (if any) so the caller can surface a warning — keeping IO and effects
 * out of the rule.
 */
export function dedupeByPath(resolved: readonly ResolvedCandidate[]): {
  readonly paths: string[];
  readonly missingExplicit: string | null;
} {
  const seen = new Set<string>();
  const paths: string[] = [];
  let missingExplicit: string | null = null;
  for (const candidate of resolved) {
    if (!candidate.exists) {
      if (candidate.isExplicit && missingExplicit === null) {
        missingExplicit = candidate.path;
      }
      continue;
    }
    if (seen.has(candidate.path)) {
      continue;
    }
    seen.add(candidate.path);
    paths.push(candidate.path);
  }
  return { paths, missingExplicit };
}

/**
 * Walk the 5 lookup rules in precedence order (lowest → highest):
 *
 * 1. <pluginDir>/tool-executor.config.json
 * 2. <cwd>/tool-executor.config.json
 * 3. <homedir>/.claude/tool-executor/tool-executor.config.json
 * 4. <xdgConfigHome>/tool-executor/tool-executor.config.json (fallback <homedir>/.config/...)
 * 5. $TOOL_EXECUTOR_CONFIG (literal path — no ${VAR} expansion of the path itself)
 *
 * Returns existing files only, deduplicated by absolute path, preserving precedence order. Logs a
 * warning if `$TOOL_EXECUTOR_CONFIG` is set but points to a missing file. All other absent layers
 * are silent.
 */
export function findConfigFiles(opts: FindConfigOptions = {}): string[] {
  const pluginDir = opts.pluginDir ?? resolve(__dirname, "..");
  const cwd = opts.cwd ?? process.cwd();
  const homedir = opts.homedir ?? os.homedir();

  const xdgRaw =
    opts.xdgConfigHome !== undefined ? opts.xdgConfigHome : process.env.XDG_CONFIG_HOME;
  const xdg = xdgRaw && xdgRaw.trim().length > 0 ? xdgRaw.trim() : resolve(homedir, ".config");

  const explicitRaw =
    opts.explicitPath !== undefined ? opts.explicitPath : process.env.TOOL_EXECUTOR_CONFIG;
  const explicit = explicitRaw && explicitRaw.trim().length > 0 ? explicitRaw.trim() : null;

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

  const resolved: ResolvedCandidate[] = candidates.map((candidate) => ({
    path: candidate.path,
    isExplicit: candidate.isExplicit,
    exists: existsSync(candidate.path),
  }));
  const { paths, missingExplicit } = dedupeByPath(resolved);
  if (missingExplicit !== null) {
    console.error(`TOOL_EXECUTOR_CONFIG points to missing file: ${missingExplicit}`);
  }
  return paths;
}

function parseLayer(path: string): ServerConfigFromFile[] | null {
  try {
    const content = readFileSync(path, "utf-8");
    const parsed = JSON.parse(content);
    const expanded = expandEnvVarsInObject(parsed);
    const validated = parseToolExecutorConfig(expanded);
    return validated.servers;
  } catch (error) {
    console.error(`Failed to load config from ${path}:`, error);
    return null;
  }
}

/**
 * Merge a list of parsed config layers into a single {@link ConfigLoadResult}.
 *
 * Each layer is either a successful parse (with a `servers` array, possibly empty) or a parse
 * failure (`servers: null`, already logged by the caller). Later layers override earlier ones by
 * `name`. Each surviving server is tagged with the source path of the layer that supplied it. Empty
 * input and all-failed layers both return null.
 */
export function mergeLoadedLayers(
  layers: ReadonlyArray<{
    readonly path: string;
    readonly servers: readonly ServerConfigFromFile[] | null;
  }>,
): ConfigLoadResult | null {
  const byName = new Map<string, LoadedServer>();
  const sources: string[] = [];

  for (const layer of layers) {
    if (layer.servers === null) {
      continue;
    }
    for (const server of layer.servers) {
      byName.set(server.name, { ...server, source: layer.path });
    }
    sources.push(layer.path);
  }

  return sources.length > 0 ? { servers: [...byName.values()], sources } : null;
}

/**
 * Load and merge config from all lookup layers (or from a single explicit path).
 *
 * - With no arguments: walks {@link findConfigFiles} rules and merges all hits.
 * - With `configPath`: loads exactly that file; returns null if it doesn't exist.
 *
 * Merge semantics: later layers (higher precedence) override earlier ones by `name`. Each returned
 * server carries a `source` field pointing to the layer that supplied it.
 *
 * Returns null when no layer contributed any servers (no files found, or every file failed to
 * parse).
 */
export function loadConfig(configPath?: string, opts?: FindConfigOptions): ConfigLoadResult | null {
  let paths: string[];
  if (configPath !== undefined) {
    const resolved = resolve(configPath);
    paths = existsSync(resolved) ? [resolved] : [];
  } else {
    paths = findConfigFiles(opts);
  }
  const layers = paths.map((path) => ({
    path,
    servers: parseLayer(path),
  }));

  return mergeLoadedLayers(layers);
}
