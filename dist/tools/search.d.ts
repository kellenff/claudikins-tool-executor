import { S as SearchToolsInput } from '../schemas-9t_yp478.js';
import { SearchResponse } from '../search.js';
import 'zod';
import '@modelcontextprotocol/sdk/client/index.js';
import '../types.js';

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
declare function oneLiner(text: string): string;
/**
 * Build the payload that handleSearchTools returns as structuredContent. Pure: derives everything
 * from `params` and `response`. Maps result descriptions through oneLiner, computes pagination
 * (has_more) against the response totalCount, and conditionally appends fallbackReason / suggestion
 * when present.
 */
declare function toSearchToolsResponse(params: SearchToolsInput, response: SearchResponse): SearchToolsResponse;
/**
 * Search for MCP tools across all wrapped servers Returns MINIMAL results - just enough to identify
 * and call the tool
 */
declare function handleSearchTools(params: SearchToolsInput): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
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
}>;

export { handleSearchTools, oneLiner, toSearchToolsResponse };
