import { Effect } from "effect";

import { getAppRuntime } from "../runtime.js";
import { searchTools } from "../search.js";
import { MAX_ONE_LINER_CHARS, ONE_LINER_ELLIPSIS_RESERVE } from "../constants.js";
import type { SearchToolsInput } from "../schemas.js";
import type { SearchResponse } from "../search.js";

/**
 * Internal shape of toSearchToolsResponse's return value. Not exported because the MCP SDK expects
 * an index-signature-compatible type at the handler boundary, so handlers must use an inline
 * anonymous return type.
 */
type SearchToolsResponse = {
  suggestion?: string | undefined;
  fallbackReason?: string | undefined;
  results: {
    name: string;
    server: string;
    description: string;
  }[];
  count: number;
  limit: number;
  offset: number;
  totalCount: number | undefined;
  has_more: boolean;
  source: "serena" | "local";
};

/** First line only, max MAX_ONE_LINER_CHARS chars. Pure. */
export function oneLiner(text: string): string {
  if (!text) {
    return "";
  }
  const line = text.split("\n")[0].trim();
  return line.length > MAX_ONE_LINER_CHARS
    ? line.slice(0, MAX_ONE_LINER_CHARS - ONE_LINER_ELLIPSIS_RESERVE) + "..."
    : line;
}

/**
 * Build the payload that handleSearchTools returns as structuredContent. Pure: derives everything
 * from `params` and `response`. Maps result descriptions through oneLiner, computes pagination
 * (has_more) against the response totalCount, and conditionally appends fallbackReason / suggestion
 * when present.
 */
export function toSearchToolsResponse(
  params: SearchToolsInput,
  response: SearchResponse,
): SearchToolsResponse {
  return {
    results: response.results.map((result) => ({
      name: result.tool.name,
      server: result.tool.server,
      description: oneLiner(result.tool.description),
    })),
    count: response.results.length,
    limit: params.limit,
    offset: params.offset,
    totalCount: response.totalCount,
    has_more: params.offset + response.results.length < (response.totalCount ?? 0),
    source: response.source,
    ...(response.fallbackReason && { fallbackReason: response.fallbackReason }),
    ...(response.suggestion && { suggestion: response.suggestion }),
  };
}

export const searchToolsEffect = (
  params: SearchToolsInput,
): Effect.Effect<
  {
    content: { type: "text"; text: string }[];
    structuredContent: ReturnType<typeof toSearchToolsResponse>;
  },
  unknown
> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => searchTools(params.query, params.limit, params.offset),
      catch: (cause) => cause,
    });
    const output = toSearchToolsResponse(params, response);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  });

/**
 * Search for MCP tools across all wrapped servers Returns MINIMAL results - just enough to identify
 * and call the tool
 */
export async function handleSearchTools(params: SearchToolsInput): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: {
    suggestion?: string | undefined;
    fallbackReason?: string | undefined;
    results: {
      name: string;
      server: string;
      description: string;
    }[];
    count: number;
    limit: number;
    offset: number;
    totalCount: number | undefined;
    has_more: boolean;
    source: "serena" | "local";
  };
}> {
  return getAppRuntime().runPromise(searchToolsEffect(params));
}
