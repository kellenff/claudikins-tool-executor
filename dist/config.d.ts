import { Schema, Effect } from 'effect';
import * as effect_Cause from 'effect/Cause';
import * as effect_Types from 'effect/Types';

declare const ConfigError_base: new <A extends Record<string, any> = {}>(args: effect_Types.VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => effect_Cause.YieldableError & {
    readonly _tag: "ConfigError";
} & Readonly<A>;
declare class ConfigError extends ConfigError_base<{
    readonly message: string;
    readonly cause?: unknown;
}> {
}

declare const ServerConfigSchema: Schema.Struct<{
    readonly name: Schema.String;
    readonly displayName: Schema.String;
    readonly command: Schema.String;
    readonly commandEnvKey: Schema.optional<Schema.String>;
    readonly trusted: Schema.optional<Schema.Boolean>;
    readonly disabled: Schema.optional<Schema.Boolean>;
    readonly args: Schema.$Array<Schema.String>;
    readonly env: Schema.optional<Schema.$Record<Schema.String, Schema.String>>;
}>;
declare const ToolExecutorConfigSchema: Schema.Struct<{
    readonly $schema: Schema.optional<Schema.String>;
    readonly servers: Schema.$Array<Schema.Struct<{
        readonly name: Schema.String;
        readonly displayName: Schema.String;
        readonly command: Schema.String;
        readonly commandEnvKey: Schema.optional<Schema.String>;
        readonly trusted: Schema.optional<Schema.Boolean>;
        readonly disabled: Schema.optional<Schema.Boolean>;
        readonly args: Schema.$Array<Schema.String>;
        readonly env: Schema.optional<Schema.$Record<Schema.String, Schema.String>>;
    }>>;
}>;
interface ServerConfigFromFile {
    name: string;
    displayName: string;
    command: string;
    commandEnvKey?: string;
    trusted?: boolean;
    disabled?: boolean;
    args: string[];
    env?: Record<string, string>;
}
interface ToolExecutorConfig {
    $schema?: string;
    servers: ServerConfigFromFile[];
}
declare const decodeToolExecutorConfig: (input: unknown) => Effect.Effect<ToolExecutorConfig, ConfigError>;
declare function parseToolExecutorConfig(input: unknown): ToolExecutorConfig;
declare function parseServerConfig(input: unknown): ServerConfigFromFile;
/**
 * A server entry tagged with the absolute path of the config layer that supplied it. Used by
 * callers (clients.ts, cli.ts) to report provenance.
 */
interface LoadedServer extends ServerConfigFromFile {
    source: string;
}
interface ConfigLoadResult {
    /** Merged server list across all layers; later layers override earlier ones by `name`. */
    servers: LoadedServer[];
    /** Absolute paths of contributing config files, in precedence order (lowest → highest). */
    sources: string[];
}
/**
 * Overrides for the path resolution rules. Defaults read from process / os. Tests inject overrides
 * to avoid touching the real homedir or env.
 */
interface FindConfigOptions {
    pluginDir?: string;
    cwd?: string;
    homedir?: string;
    xdgConfigHome?: string | null;
    explicitPath?: string | null;
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
declare function dedupeByPath(resolved: readonly ResolvedCandidate[]): {
    readonly paths: string[];
    readonly missingExplicit: string | null;
};
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
declare function findConfigFiles(opts?: FindConfigOptions): string[];
/**
 * Merge a list of parsed config layers into a single {@link ConfigLoadResult}.
 *
 * Each layer is either a successful parse (with a `servers` array, possibly empty) or a parse
 * failure (`servers: null`, already logged by the caller). Later layers override earlier ones by
 * `name`. Each surviving server is tagged with the source path of the layer that supplied it. Empty
 * input and all-failed layers both return null.
 */
declare function mergeLoadedLayers(layers: ReadonlyArray<{
    readonly path: string;
    readonly servers: readonly ServerConfigFromFile[] | null;
}>): ConfigLoadResult | null;
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
declare function loadConfig(configPath?: string, opts?: FindConfigOptions): ConfigLoadResult | null;

export { type ConfigLoadResult, type FindConfigOptions, type LoadedServer, type ServerConfigFromFile, ServerConfigSchema, type ToolExecutorConfig, ToolExecutorConfigSchema, decodeToolExecutorConfig, dedupeByPath, findConfigFiles, loadConfig, mergeLoadedLayers, parseServerConfig, parseToolExecutorConfig };
