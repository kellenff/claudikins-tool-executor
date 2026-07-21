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

export { type SearchResponse, type SearchResult, disconnectRegistrySerena, escapeRegexTerm, getCategories, getToolByName, listToolsInCategory, loadToolDefinition, searchTools };
