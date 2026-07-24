import type { AnySchema } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { Effect, Schema } from "effect";

import {
  EXECUTE_CODE_DEFAULT_TIMEOUT_MS,
  EXECUTE_CODE_MAX_TIMEOUT_MS,
  EXECUTE_CODE_MIN_TIMEOUT_MS,
  SEARCH_TOOLS_DEFAULT_LIMIT,
  SEARCH_TOOLS_MAX_LIMIT,
} from "./constants.js";

const STRICT = { onExcessProperty: "error" as const };

const searchToolsInputSchema = Schema.Struct({
  query: Schema.String.check(Schema.isNonEmpty({ message: "Query cannot be empty" })).annotate({
    description: "Search query for finding relevant tools",
  }),
  limit: Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({
      minimum: 1,
      maximum: SEARCH_TOOLS_MAX_LIMIT,
    }),
  )
    .annotate({
      description: `Maximum results to return (default: ${SEARCH_TOOLS_DEFAULT_LIMIT})`,
    })
    .pipe(Schema.withDecodingDefault(Effect.succeed(SEARCH_TOOLS_DEFAULT_LIMIT))),
  offset: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))
    .annotate({
      description: "Number of results to skip for pagination (default: 0)",
    })
    .pipe(Schema.withDecodingDefault(Effect.succeed(0))),
});

/** Effect schema; cast satisfies legacy `registerTool` typing until Task 8. */
export const SearchToolsInputSchema = searchToolsInputSchema as unknown as AnySchema;

export type SearchToolsInput = typeof searchToolsInputSchema.Type;

export function parseSearchToolsInput(input: unknown): SearchToolsInput {
  return Schema.decodeUnknownSync(searchToolsInputSchema, STRICT)(input);
}

const getToolSchemaInputSchema = Schema.Struct({
  name: Schema.String.check(Schema.isNonEmpty({ message: "Tool name cannot be empty" })).annotate({
    description: "Tool name (from search_tools results)",
  }),
});

/** Effect schema; cast satisfies legacy `registerTool` typing until Task 8. */
export const GetToolSchemaInputSchema = getToolSchemaInputSchema as unknown as AnySchema;

export type GetToolSchemaInput = typeof getToolSchemaInputSchema.Type;

export function parseGetToolSchemaInput(input: unknown): GetToolSchemaInput {
  return Schema.decodeUnknownSync(getToolSchemaInputSchema, STRICT)(input);
}

const executeCodeInputSchema = Schema.Struct({
  code: Schema.String.check(Schema.isNonEmpty({ message: "Code cannot be empty" })).annotate({
    description: "TypeScript/JavaScript code to execute",
  }),
  timeout: Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({
      minimum: EXECUTE_CODE_MIN_TIMEOUT_MS,
      maximum: EXECUTE_CODE_MAX_TIMEOUT_MS,
    }),
  )
    .annotate({
      description: `Execution timeout in ms (default: ${EXECUTE_CODE_DEFAULT_TIMEOUT_MS})`,
    })
    .pipe(Schema.withDecodingDefault(Effect.succeed(EXECUTE_CODE_DEFAULT_TIMEOUT_MS))),
});

/** Effect schema; cast satisfies legacy `registerTool` typing until Task 8. */
export const ExecuteCodeInputSchema = executeCodeInputSchema as unknown as AnySchema;

export type ExecuteCodeInput = typeof executeCodeInputSchema.Type;

export function parseExecuteCodeInput(input: unknown): ExecuteCodeInput {
  return Schema.decodeUnknownSync(executeCodeInputSchema, STRICT)(input);
}
