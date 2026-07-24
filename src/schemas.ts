import { Effect, Schema } from "effect";

import {
  EXECUTE_CODE_DEFAULT_TIMEOUT_MS,
  EXECUTE_CODE_MAX_TIMEOUT_MS,
  EXECUTE_CODE_MIN_TIMEOUT_MS,
  SEARCH_TOOLS_DEFAULT_LIMIT,
  SEARCH_TOOLS_MAX_LIMIT,
} from "./constants.js";

const STRICT = { onExcessProperty: "error" as const };

export const SearchToolsInputSchema = Schema.Struct({
  query: Schema.String.annotate({
    description: "Search query for finding relevant tools",
  }).check(Schema.isNonEmpty({ message: "Query cannot be empty" })),
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

export type SearchToolsInput = typeof SearchToolsInputSchema.Type;

export function parseSearchToolsInput(input: unknown): SearchToolsInput {
  return Schema.decodeUnknownSync(SearchToolsInputSchema, STRICT)(input);
}

export const GetToolSchemaInputSchema = Schema.Struct({
  name: Schema.String.annotate({
    description: "Tool name (from search_tools results)",
  }).check(Schema.isNonEmpty({ message: "Tool name cannot be empty" })),
});

export type GetToolSchemaInput = typeof GetToolSchemaInputSchema.Type;

export function parseGetToolSchemaInput(input: unknown): GetToolSchemaInput {
  return Schema.decodeUnknownSync(GetToolSchemaInputSchema, STRICT)(input);
}

export const ExecuteCodeInputSchema = Schema.Struct({
  code: Schema.String.annotate({
    description: "TypeScript/JavaScript code to execute",
  }).check(Schema.isNonEmpty({ message: "Code cannot be empty" })),
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

export type ExecuteCodeInput = typeof ExecuteCodeInputSchema.Type;

export function parseExecuteCodeInput(input: unknown): ExecuteCodeInput {
  return Schema.decodeUnknownSync(ExecuteCodeInputSchema, STRICT)(input);
}
