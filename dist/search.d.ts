import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ToolDefinition } from './types.js';

/**
 * Search result from tool search
 */
interface SearchResult {
    tool: ToolDefinition;
    score: number;
    matchContext?: string;
}
/**
 * Search response
 */
interface SearchResponse {
    results: SearchResult[];
    source: "serena" | "local";
    totalCount?: number;
    suggestion?: string;
    fallbackReason?: string;
}
/**
 * Pure: data shape for the Serena stdio transport. No I/O, fully testable.
 * Field types match the underlying SDK's `StdioServerParameters` so the spec
 * can be passed straight to the constructor without a cast.
 */
type SerenaTransportSpec = {
    readonly command: string;
    readonly args: string[];
    readonly env: Record<string, string>;
};
/**
 * Build the stdio transport spec for launching the Serena MCP server.
 * Pure: no I/O, no globals read beyond `process.env` passed by reference.
 */
declare const buildSerenaTransportSpec: () => SerenaTransportSpec;
/**
 * Tagged failure modes for `connectRegistrySerena`. Distinguishing
 * transport-spawn failures from `activate_project` rejections lets callers
 * log a precise cause without inspecting thrown values.
 */
type RegistrySerenaConnectError = {
    readonly tag: "connect_failed";
    readonly cause: unknown;
} | {
    readonly tag: "activate_project_failed";
    readonly cause: unknown;
};
type RegistrySerenaConnectResult = {
    readonly ok: true;
    readonly client: Client;
} | {
    readonly ok: false;
    readonly error: RegistrySerenaConnectError;
};
/**
 * Connect to the registry Serena MCP server and activate the registry project.
 * Returns a tagged result; the caller (typically `getRegistrySerena`) decides
 * whether to retain the client. Pure with respect to module state: does not
 * assign to `registrySerena` itself.
 */
declare function connectRegistrySerena(): Promise<RegistrySerenaConnectResult>;
/**
 * Escapes regex metacharacters in a single search term so the term can be
 * embedded into a lookahead pattern without altering its literal meaning.
 *
 * @param {string} term - Raw search term, may contain any character.
 * @returns {string} The term with regex metacharacters (`.*+?^${}()|[]\`) escaped.
 */
declare const escapeRegexTerm: (term: string) => string;
/**
 * Splits a free-text search query into individual terms on whitespace,
 * discarding empty fragments. Whitespace-only input yields `[]`.
 *
 * @param {string} query - Free-text query string.
 * @returns {string[]} Non-empty term fragments in original order.
 */
declare const tokenizeQuery: (query: string) => string[];
/**
 * Builds a regex substring pattern for Serena's `search_for_pattern`.
 *
 * For a single term, returns the term as-is (already escaped by the caller).
 * For multiple terms, wraps each in a lookahead `(?=.*term)` so all terms must
 * appear in any order, terminating with `.*`. For an empty array, returns `.*`
 * (matches anything — preserves the current implicit behavior).
 *
 * @param {string[]} terms - Pre-escaped search terms.
 * @returns {string} The substring pattern to pass to `search_for_pattern`.
 */
declare const buildLookaheadPattern: (terms: string[]) => string;
/**
 * Extracts every registry-shaped YAML file path from a single text snippet.
 *
 * Matches substrings of the form `<category>/<server>/<file>.yaml` (or `.yml`),
 * case-insensitive. Returns an empty array if no matches.
 *
 * @param {string} text - Free-text snippet (e.g., one item from a Serena response).
 * @returns {string[]} Matched path substrings in source order, possibly empty.
 */
declare const extractRegistryPaths: (text: string) => string[];
/**
 * Deduplicates a list of file paths while preserving first-occurrence order.
 *
 * @param {string[]} paths - Possibly duplicated file paths.
 * @returns {string[]} The same paths with later duplicates removed.
 */
declare const dedupePaths: (paths: string[]) => string[];
/**
 * Load a tool definition from a YAML file
 */
declare function loadToolDefinition(filePath: string): Promise<ToolDefinition | null>;
/**
 * Search for tools matching a query
 */
declare function searchTools(query: string, limit?: number, offset?: number): Promise<SearchResponse>;
/**
 * Get all available categories in the registry
 */
declare function getCategories(): Promise<string[]>;
/**
 * List all tools in a category
 */
declare function listToolsInCategory(category: string): Promise<ToolDefinition[]>;
/**
 * Get a specific tool by name (for full schema retrieval)
 */
declare function getToolByName(toolName: string): Promise<ToolDefinition | null>;
/**
 * Disconnect the registry Serena client (for cleanup)
 */
declare function disconnectRegistrySerena(): Promise<void>;

export { type SearchResponse, type SearchResult, buildLookaheadPattern, buildSerenaTransportSpec, connectRegistrySerena, dedupePaths, disconnectRegistrySerena, escapeRegexTerm, extractRegistryPaths, getCategories, getToolByName, listToolsInCategory, loadToolDefinition, searchTools, tokenizeQuery };
