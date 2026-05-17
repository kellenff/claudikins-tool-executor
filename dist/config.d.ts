import { z } from 'zod';

declare const ServerConfigSchema: z.ZodObject<{
    name: z.ZodString;
    displayName: z.ZodString;
    command: z.ZodString;
    commandEnvKey: z.ZodOptional<z.ZodString>;
    trusted: z.ZodOptional<z.ZodBoolean>;
    args: z.ZodArray<z.ZodString>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
declare const ToolExecutorConfigSchema: z.ZodObject<{
    $schema: z.ZodOptional<z.ZodString>;
    servers: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        displayName: z.ZodString;
        command: z.ZodString;
        commandEnvKey: z.ZodOptional<z.ZodString>;
        trusted: z.ZodOptional<z.ZodBoolean>;
        args: z.ZodArray<z.ZodString>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strict>;
type ToolExecutorConfig = z.infer<typeof ToolExecutorConfigSchema>;
type ServerConfigFromFile = z.infer<typeof ServerConfigSchema>;
/**
 * A server entry tagged with the absolute path of the config layer that supplied it.
 * Used by callers (clients.ts, cli.ts) to report provenance.
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
 * Overrides for the path resolution rules. Defaults read from process / os.
 * Tests inject overrides to avoid touching the real homedir or env.
 */
interface FindConfigOptions {
    pluginDir?: string;
    cwd?: string;
    homedir?: string;
    xdgConfigHome?: string | null;
    explicitPath?: string | null;
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
declare function findConfigFiles(opts?: FindConfigOptions): string[];
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
declare function loadConfig(configPath?: string, opts?: FindConfigOptions): ConfigLoadResult | null;

export { type ConfigLoadResult, type FindConfigOptions, type LoadedServer, type ServerConfigFromFile, ServerConfigSchema, type ToolExecutorConfig, ToolExecutorConfigSchema, findConfigFiles, loadConfig };
