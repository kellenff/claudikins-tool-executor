import { Context } from "effect";
import type { Effect } from "effect";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { ConfigLoadResult } from "../config.js";
import type { ExecuteCodeInput, GetToolSchemaInput, SearchToolsInput } from "../schemas.js";
import type { SearchResponse } from "../search.js";
import type { ExecutionResult } from "../types.js";
import type {
  ConfigError,
  SandboxEvalError,
  SandboxTimeout,
  SearchError,
  WorkspaceError,
} from "../errors.js";

/** App config: loads merged user/default server list. */
export class AppConfig extends Context.Service<
  AppConfig,
  {
    readonly load: () => Effect.Effect<ConfigLoadResult, ConfigError>;
  }
>()("AppConfig") {}

/** Tool discovery: search the local registry by query. */
export class Search extends Context.Service<
  Search,
  {
    readonly searchTools: (input: SearchToolsInput) => Effect.Effect<SearchResponse, SearchError>;
  }
>()("Search") {}

/** Tool schema lookup: fetch inputSchema + metadata for a named tool. */
export class ToolSchema extends Context.Service<
  ToolSchema,
  {
    readonly get: (input: GetToolSchemaInput) => Effect.Effect<CallToolResult, never>;
  }
>()("ToolSchema") {}

/** Sandbox execution: run TS/JS code against the live MCP client pool. */
export class Sandbox extends Context.Service<
  Sandbox,
  {
    readonly execute: (
      input: ExecuteCodeInput,
    ) => Effect.Effect<ExecutionResult, SandboxEvalError | SandboxTimeout>;
  }
>()("Sandbox") {}

/** MCP client pool: lazy-connect, idle cleanup, shutdown on dispose. */
export class Clients extends Context.Service<
  Clients,
  {
    readonly getClient: (name: string) => Effect.Effect<unknown, never>;
    readonly disconnectClient: (name: string) => Effect.Effect<void, never>;
    readonly disconnectAll: () => Effect.Effect<void, never>;
    readonly cleanupIdle: () => Effect.Effect<void, never>;
    readonly availableNames: () => Effect.Effect<string[], never>;
    readonly connectedNames: () => Effect.Effect<string[], never>;
  }
>()("Clients") {}

/** Sandbox workspace: path-traversal-safe FS ops scoped to the workspace root. */
export class Workspace extends Context.Service<
  Workspace,
  {
    readonly read: (path: string) => Effect.Effect<string, WorkspaceError>;
    readonly write: (path: string, data: string) => Effect.Effect<void, WorkspaceError>;
    readonly append: (path: string, data: string) => Effect.Effect<void, WorkspaceError>;
    readonly delete: (path: string) => Effect.Effect<void, WorkspaceError>;
    readonly readJSON: <T = unknown>(path: string) => Effect.Effect<T, WorkspaceError>;
    readonly writeJSON: (path: string, data: unknown) => Effect.Effect<void, WorkspaceError>;
    readonly readBuffer: (path: string) => Effect.Effect<Buffer, WorkspaceError>;
    readonly writeBuffer: (path: string, data: Buffer) => Effect.Effect<void, WorkspaceError>;
    readonly list: (path?: string) => Effect.Effect<string[], WorkspaceError>;
    readonly glob: (pattern: string) => Effect.Effect<string[], WorkspaceError>;
    readonly exists: (path: string) => Effect.Effect<boolean, WorkspaceError>;
    readonly stat: (
      path: string,
    ) => Effect.Effect<{ size: number; mtime: Date; isDir: boolean }, WorkspaceError>;
    readonly cleanupMcpResults: () => Effect.Effect<number, never>;
  }
>()("Workspace") {}
