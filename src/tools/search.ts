import { searchTools } from "../search.js";
import type { SearchToolsInput } from "../schemas.js";

/** First line only, max 80 chars */
function oneLiner(text: string): string {
  if (!text) return "";
  const line = text.split("\n")[0].trim();
  return line.length > 80 ? line.slice(0, 77) + "..." : line;
}

/**
 * Search for MCP tools across all wrapped servers
 * Returns MINIMAL results - just enough to identify and call the tool
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
  const response = await searchTools(params.query, params.limit, params.offset);

  const output = {
    results: response.results.map((r) => ({
      name: r.tool.name,
      server: r.tool.server,
      description: oneLiner(r.tool.description),
    })),
    // Pagination metadata (MCP best practice)
    count: response.results.length,
    limit: params.limit,
    offset: params.offset,
    totalCount: response.totalCount,
    has_more: (params.offset + response.results.length) < (response.totalCount || 0),
    // Source info
    source: response.source,
    ...(response.fallbackReason && { fallbackReason: response.fallbackReason }),
    ...(response.suggestion && { suggestion: response.suggestion }),
  };

  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    structuredContent: output,
  };
}
