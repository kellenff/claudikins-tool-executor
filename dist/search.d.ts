import { ToolDefinition } from './types.js';
import '@modelcontextprotocol/sdk/client/index.js';

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
 * @param {string} text - Free-text snippet (e.g. one item from a Serena response).
 * @returns {string[]} Matched path substrings in source order, possibly empty.
 */
declare const extractRegistryPaths: (text: string) => string[];
/**
 * Deduplicates a list of file paths while preserving first-occurrence order.
 *
 * @param {string[]} paths - Possibly-duplicated file paths.
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

export { type SearchResponse, type SearchResult, buildLookaheadPattern, dedupePaths, disconnectRegistrySerena, escapeRegexTerm, extractRegistryPaths, getCategories, getToolByName, listToolsInCategory, loadToolDefinition, searchTools, tokenizeQuery };
