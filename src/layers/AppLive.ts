import { Effect, Layer } from "effect";

import { executeCode } from "../sandbox/runtime.js";
import { getToolByName, searchTools } from "../search.js";
import { loadConfig } from "../config.js";
import type { ConfigLoadResult } from "../config.js";
import { ConfigError, SandboxEvalError, SandboxTimeout, SearchError } from "../errors.js";
import { errorToolSchemaResponse, toToolSchemaResponse } from "../tools/schema.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ExecutionResult, ToolDefinition } from "../types.js";
import type { ExecuteCodeInput, GetToolSchemaInput, SearchToolsInput } from "../schemas.js";
import type { SearchResponse } from "../search.js";
import { EXECUTE_CODE_DEFAULT_TIMEOUT_MS } from "../constants.js";

import { AppConfig, Sandbox, Search, ToolSchema } from "./services.js";

/** Empty config fallback when no user config files exist on disk. */
const EMPTY_CONFIG: ConfigLoadResult = { servers: [], sources: [] };

/** Wrap loadConfig (sync, nullable) into Effect, surfacing throwables as ConfigError. */
const AppConfigLive: Layer.Layer<AppConfig> = Layer.succeed(AppConfig, {
  load: () =>
    Effect.try({
      try: () => loadConfig() ?? EMPTY_CONFIG,
      catch: (cause) =>
        new ConfigError({
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    }),
});

/** Wrap async searchTools (Promise) into Effect, mapping throws to SearchError. */
const SearchLive: Layer.Layer<Search> = Layer.succeed(Search, {
  searchTools: (input: SearchToolsInput): Effect.Effect<SearchResponse, SearchError> =>
    Effect.tryPromise({
      try: () => searchTools(input.query, input.limit, input.offset) as Promise<SearchResponse>,
      catch: (cause) =>
        new SearchError({
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    }),
});

/** Wrap getToolByName; never fails — missing tools return the error response. */
const ToolSchemaLive: Layer.Layer<ToolSchema> = Layer.succeed(ToolSchema, {
  get: (input: GetToolSchemaInput): Effect.Effect<CallToolResult, never> =>
    Effect.gen(function* () {
      const tool: ToolDefinition | null = yield* Effect.tryPromise({
        try: () => getToolByName(input.name),
        catch: (e) => e,
      }).pipe(Effect.orElseSucceed(() => null));
      if (!tool) {
        return errorToolSchemaResponse(input.name) as CallToolResult;
      }
      return toToolSchemaResponse(tool) as CallToolResult;
    }),
});

/** Wrap executeCode, mapping throws to SandboxEvalError and timeout to SandboxTimeout. */
const SandboxLive: Layer.Layer<Sandbox> = Layer.succeed(Sandbox, {
  execute: (
    input: ExecuteCodeInput,
  ): Effect.Effect<ExecutionResult, SandboxEvalError | SandboxTimeout> =>
    Effect.tryPromise({
      try: () =>
        executeCode(
          input.code,
          input.timeout ?? EXECUTE_CODE_DEFAULT_TIMEOUT_MS,
        ) as Promise<ExecutionResult>,
      catch: (cause) => {
        if (
          cause &&
          typeof cause === "object" &&
          "_tag" in cause &&
          (cause as { _tag: string })._tag === "SandboxTimeout"
        ) {
          return new SandboxTimeout({
            timeoutMs: input.timeout ?? EXECUTE_CODE_DEFAULT_TIMEOUT_MS,
          });
        }
        return new SandboxEvalError({
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        });
      },
    }),
});

/** Composed app layer. Behavior-preserving: each tag delegates to current sync/async APIs. */
export const AppLive: Layer.Layer<AppConfig | Sandbox | Search | ToolSchema> = Layer.mergeAll(
  AppConfigLive,
  SandboxLive,
  SearchLive,
  ToolSchemaLive,
);
