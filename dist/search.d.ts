import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ToolDefinition } from './types.js';

/** Search result from tool search */
interface SearchResult {
    tool: ToolDefinition;
    score: number;
    matchContext?: string;
}
/** Search response */
interface SearchResponse {
    results: SearchResult[];
    source: "serena" | "local";
    totalCount?: number;
    suggestion?: string;
    fallbackReason?: string;
}
/**
 * Represents the configuration required to launch and communicate with a Serena transport process.
 * Encapsulates the executable command, its arguments, and any environment variables needed to spawn
 * the process.
 */
type SerenaTransportSpec = {
    readonly command: string;
    readonly args: string[];
    readonly env: Record<string, string>;
};
/**
 * Build the stdio transport spec for launching the Serena MCP server. Pure: no I/O, no globals read
 * beyond `process.env` passed by reference.
 */
declare const buildSerenaTransportSpec: () => SerenaTransportSpec;
/**
 * Represents an error that can occur while connecting to or interacting with the Serena registry.
 *
 * This is a discriminated union of error variants, where each variant is identified by its `tag`
 * property. The `cause` field holds the underlying error or reason that triggered the failure, and
 * may be of any type.
 */
type RegistrySerenaConnectError = {
    readonly tag: "connect_failed";
    readonly cause: unknown;
} | {
    readonly tag: "activate_project_failed";
    readonly cause: unknown;
};
/**
 * Represents the outcome of a registry Serena connection attempt.
 *
 * This is a discriminated union indicating either a successful connection, in which case the
 * resulting {@link Client} is provided, or a failed connection, in which case the corresponding
 * {@link RegistrySerenaConnectError} describing the failure is returned.
 *
 * Consumers should narrow on the `ok` field to safely access the type-specific payload.
 */
type RegistrySerenaConnectResult = {
    readonly ok: true;
    readonly client: Client;
} | {
    readonly ok: false;
    readonly error: RegistrySerenaConnectError;
};
/**
 * Connect to the registry Serena MCP server and activate the registry project. Returns a tagged
 * result; the caller (typically `getRegistrySerena`) decides whether to retain the client. Pure
 * with respect to module state: does not assign to `registrySerena` itself.
 */
declare function connectRegistrySerena(): Promise<RegistrySerenaConnectResult>;
/**
 * Escapes regex metacharacters in a single search term so the term can be embedded into a lookahead
 * pattern without altering its literal meaning.
 *
 * @param {string} term - Raw search term, may contain any character.
 * @returns {string} The term with regex metacharacters (`.*+?^${}()|[]\`) escaped.
 */
declare const escapeRegexTerm: (term: string) => string;
/**
 * Splits a free-text search query into individual terms on whitespace, discarding empty fragments.
 * Whitespace-only input yields `[]`.
 *
 * @param {string} query - Free-text query string.
 * @returns {string[]} Non-empty term fragments in original order.
 */
declare const tokenizeQuery: (query: string) => string[];
/**
 * Builds a regex substring pattern for Serena's `search_for_pattern`.
 *
 * For a single term, returns the term as-is (already escaped by the caller). For multiple terms,
 * wraps each in a lookahead `(?=.*term)` so all terms must appear in any order, terminating with
 * `.*`. For an empty array, returns `.*` (matches anything — preserves the current implicit
 * behavior).
 *
 * @param {string[]} terms - Pre-escaped search terms.
 * @returns {string} The substring pattern to pass to `search_for_pattern`.
 */
declare const buildLookaheadPattern: (terms: string[]) => string;
/**
 * Extracts every registry-shaped YAML file path from a single text snippet.
 *
 * Matches substrings of the form `<category>/<server>/<file>.yaml` (or `.yml`), case-insensitive.
 * Returns an empty array if no matches.
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
/** Load a tool definition from a YAML file */
declare function loadToolDefinition(filePath: string): Promise<ToolDefinition | null>;
/**
 * Load YAML tool definitions from a list of file paths concurrently, dropping any that fail to load
 * or fail validation. Surviving entries preserve the input order.
 */
declare const loadToolsFromFiles: (filePaths: readonly string[]) => Promise<ToolDefinition[]>;
/**
 * Searches for tools matching the given query, with pagination support.
 *
 * Attempts semantic search first and falls back to text-based search if unavailable or no matches
 * are found.
 *
 * @param query - The search query string.
 * @param limit - Maximum number of results to return. Defaults to DEFAULT_SEARCH_LIMIT.
 * @param offset - Number of results to skip for pagination. Defaults to 0.
 * @returns A promise that resolves to a SearchResponse containing the results, source, total count,
 *   and optional fallback reason or suggestion.
 */
declare function searchTools(query: string, limit?: number, offset?: number): Promise<SearchResponse>;
/** Get all available categories in the registry */
declare function getCategories(): Promise<string[]>;
/** List all tools in a category */
declare function listToolsInCategory(category: string): Promise<ToolDefinition[]>;
/** Get a specific tool by name (for full schema retrieval) */
declare function getToolByName(toolName: string): Promise<ToolDefinition | null>;
/** Disconnect the registry Serena client (for cleanup) */
declare function disconnectRegistrySerena(): Promise<void>;

export { type SearchResponse, type SearchResult, buildLookaheadPattern, buildSerenaTransportSpec, connectRegistrySerena, dedupePaths, disconnectRegistrySerena, escapeRegexTerm, extractRegistryPaths, getCategories, getToolByName, listToolsInCategory, loadToolDefinition, loadToolsFromFiles, searchTools, tokenizeQuery };
