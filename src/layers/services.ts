import { Context } from "effect";
import type { Effect } from "effect";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { ConfigLoadResult } from "../config.js";
import type { ExecuteCodeInput, GetToolSchemaInput, SearchToolsInput } from "../schemas.js";
import type { SearchResponse } from "../search.js";
import type { ExecutionResult } from "../types.js";
import type { ConfigError, SandboxEvalError, SandboxTimeout, SearchError } from "../errors.js";

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
