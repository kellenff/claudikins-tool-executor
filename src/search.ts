import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import yaml from "js-yaml";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { initBM25, isBM25Ready, searchBM25 } from "./bm25.js";
import {
  BM25_RANK_DECAY,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_SCORE,
  MATCH_CONTEXT_CHARS,
  MCP_CLIENT_VERSION,
} from "./constants.js";
import type { ToolDefinition } from "./types.js";

/**
 * Search result from tool search
 */
export interface SearchResult {
  tool: ToolDefinition;
  score: number;
  matchContext?: string;
}

/**
 * Search response
 */
export interface SearchResponse {
  results: SearchResult[];
  source: "serena" | "local";
  totalCount?: number;
  suggestion?: string;
  fallbackReason?: string;
}

type SerenaContentItem = {
  type: string;
  text: string;
};

// Absolute path to registry, relative to this module (not cwd)
const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_ROOT = resolve(__dirname, "..", "registry");

/**
 * Dedicated Serena client for registry search (separate from sandbox)
 */
let registrySerena: Client | null = null;

/**
 * Track in-flight connection promise to avoid duplicate connections
 */
let connectionPromise: Promise<Client | null> | null = null;

/**
 * Get or create the registry Serena client
 */
async function getRegistrySerena(): Promise<Client | null> {
  // Already connected
  if (registrySerena) {
    return registrySerena;
  }

  // Connection already in progress - wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  // Start new connection
  connectionPromise = connectRegistrySerena();
  try {
    return await connectionPromise;
  } finally {
    connectionPromise = null;
  }
}

/**
 * Internal connection logic for registry Serena
 */
async function connectRegistrySerena(): Promise<Client | null> {
  try {
    const client = new Client(
      { name: "claudikins-registry-search", version: MCP_CLIENT_VERSION },
      { capabilities: {} },
    );
    const transport = new StdioClientTransport({
      command: "uvx",
      args: ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server"],
      env: process.env as Record<string, string>,
    });

    await client.connect(transport);

    // Activate the registry project
    await client.callTool({
      name: "activate_project",
      arguments: { project: REGISTRY_ROOT },
    });

    registrySerena = client;
    console.error("Registry Serena connected and project activated");
    return client;
  } catch (error) {
    console.error("Failed to connect registry Serena:", error);
    return null;
  }
}

/**
 * Escapes regex metacharacters in a single search term so the term can be
 * embedded into a lookahead pattern without altering its literal meaning.
 *
 * @param {string} term - Raw search term, may contain any character.
 * @returns {string} The term with regex metacharacters (`.*+?^${}()|[]\`) escaped.
 */
export const escapeRegexTerm = (term: string): string =>
  term.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/**
 * Splits a free-text search query into individual terms on whitespace,
 * discarding empty fragments. Whitespace-only input yields `[]`.
 *
 * @param {string} query - Free-text query string.
 * @returns {string[]} Non-empty term fragments in original order.
 */
export const tokenizeQuery = (query: string): string[] => query.split(/\s+/).filter(Boolean);

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
export const buildLookaheadPattern = (terms: string[]): string => {
  if (terms.length === 0) {
    return ".*";
  }
  if (terms.length === 1) {
    return terms[0];
  }
  return terms.map((term) => `(?=.*${term})`).join("") + ".*";
};

/**
 * Extracts every registry-shaped YAML file path from a single text snippet.
 *
 * Matches substrings of the form `<category>/<server>/<file>.yaml` (or `.yml`),
 * case-insensitive. Returns an empty array if no matches.
 *
 * @param {string} text - Free-text snippet (e.g. one item from a Serena response).
 * @returns {string[]} Matched path substrings in source order, possibly empty.
 */
export const extractRegistryPaths = (text: string): string[] =>
  text.match(/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[^\s:]+\.ya?ml/gi) ?? [];

/**
 * Deduplicates a list of file paths while preserving first-occurrence order.
 *
 * @param {string[]} paths - Possibly-duplicated file paths.
 * @returns {string[]} The same paths with later duplicates removed.
 */
export const dedupePaths = (paths: string[]): string[] => {
  const seen = new Set<string>();
  return paths.filter((path) => (seen.has(path) ? false : seen.add(path)));
};

/**
 * Load a tool definition from a YAML file
 */
export async function loadToolDefinition(filePath: string): Promise<ToolDefinition | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    const parsed = yaml.load(content) as ToolDefinition;

    // Validate required fields
    if (!parsed.name || !parsed.server || !parsed.description) {
      console.error(`Invalid tool definition: ${filePath}`);
      return null;
    }

    return parsed as ToolDefinition;
  } catch (error) {
    console.error(`Failed to load tool: ${filePath}`, error);
    return null;
  }
}

/**
 * Resolves a registry-relative path against REGISTRY_ROOT, loads its
 * ToolDefinition, and packages it as a SearchResult. Returns null if the
 * file cannot be loaded.
 *
 * @param {string} match - Path relative to the registry root.
 * @param {string} contextText - Source text from which the match was discovered;
 *   truncated to MATCH_CONTEXT_CHARS for the SearchResult.matchContext field.
 * @returns {Promise<SearchResult | null>} The result, or null if the file failed to load.
 */
const loadToolResult = async (match: string, contextText: string): Promise<SearchResult | null> => {
  const fullPath = resolve(REGISTRY_ROOT, match);
  const tool = await loadToolDefinition(fullPath);
  if (!tool) {
    return null;
  }
  return {
    tool,
    score: DEFAULT_SEARCH_SCORE,
    matchContext: contextText.slice(0, MATCH_CONTEXT_CHARS),
  };
};

/**
 * Search tools using Registry Serena (dedicated instance for tool search)
 */
const searchWithSerena = async (query: string, limit: number): Promise<SearchResult[] | null> => {
  try {
    const serena = await getRegistrySerena();
    if (!serena) {
      return null;
    }

    const terms = tokenizeQuery(query).map(escapeRegexTerm);
    const pattern = buildLookaheadPattern(terms);

    const result = (await serena.callTool({
      name: "search_for_pattern",
      arguments: {
        substring_pattern: pattern,
        relative_path: ".",
        context_lines_before: 2,
        context_lines_after: 2,
      },
    })) as { content?: SerenaContentItem[] };

    if (!result.content || !Array.isArray(result.content)) {
      return null;
    }

    const texts = result.content
      .filter((item): item is { type: "text"; text: string } => item.type === "text")
      .map((item) => item.text);

    const matches = dedupePaths(texts.flatMap(extractRegistryPaths));

    const results = await Promise.all(
      matches.slice(0, limit).map((match) => loadToolResult(match, texts[0] ?? "")),
    );

    return results.filter((entry) => entry !== null);
  } catch (error) {
    console.error("Serena search failed:", error);
    return null;
  }
};

/**
 * Load all tools for BM25 indexing
 */
async function loadAllTools(): Promise<ToolDefinition[]> {
  const files = await glob("**/*.{yaml,yml}", {
    cwd: REGISTRY_ROOT,
    absolute: true,
  });

  const tools: ToolDefinition[] = [];
  for (const file of files) {
    const tool = await loadToolDefinition(file);
    if (tool) {
      tools.push(tool);
    }
  }
  return tools;
}

/**
 * Search tools using local glob + text matching (fallback)
 */
async function searchLocally(query: string, limit: number): Promise<SearchResult[]> {
  // Try BM25 first (better ranking)
  if (!isBM25Ready()) {
    try {
      const allTools = await loadAllTools();
      initBM25(allTools);
      console.error(`BM25 index built with ${allTools.length} tools`);
    } catch (error) {
      console.error("Failed to initialize BM25:", error);
    }
  }

  if (isBM25Ready()) {
    const bm25Results = searchBM25(query, limit);
    if (bm25Results.length > 0) {
      return bm25Results.map((tool, idx) => ({
        tool,
        score: 1 - idx * BM25_RANK_DECAY,
      }));
    }
  }

  // Fall back to simple text matching
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(Boolean);
  const files = await glob("**/*.{yaml,yml}", {
    cwd: REGISTRY_ROOT,
    absolute: true,
  });

  const results: SearchResult[] = [];

  for (const file of files) {
    const tool = await loadToolDefinition(file);
    if (!tool) {
      continue;
    }

    // Score based on term matches
    const searchText =
      `${tool.name} ${tool.description} ${tool.category || ""} ${tool.server}`.toLowerCase();
    let score = 0;

    for (const term of queryTerms) {
      if (searchText.includes(term)) {
        score += 1;
        // Bonus for name/category match
        if (tool.name.toLowerCase().includes(term)) {
          score += 2;
        }
        if (tool.category?.toLowerCase().includes(term)) {
          score += 1;
        }
      }
    }

    if (score > 0) {
      results.push({
        tool,
        score: score / queryTerms.length,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Search for tools matching a query
 */
export async function searchTools(
  query: string,
  limit = DEFAULT_SEARCH_LIMIT,
  offset = 0,
): Promise<SearchResponse> {
  // Request more results to support pagination
  const fetchLimit = offset + limit;

  // Try Serena first
  const serenaResults = await searchWithSerena(query, fetchLimit);
  if (serenaResults && serenaResults.length > 0) {
    const paginatedResults = serenaResults.slice(offset, offset + limit);
    return {
      results: paginatedResults,
      source: "serena",
      totalCount: serenaResults.length,
    };
  }

  // Fall back to local search
  const localResults = await searchLocally(query, fetchLimit);
  const fallbackReason =
    serenaResults === null
      ? "Serena unavailable - using text search"
      : "No semantic matches - using text search";

  if (localResults.length === 0) {
    return {
      results: [],
      source: "local",
      totalCount: 0,
      fallbackReason,
      suggestion:
        "Try broader terms like 'image', 'code search', 'graph analysis', 'diagram', or browse categories: code-nav, graph-analysis, knowledge, ai-models, web, ui",
    };
  }

  const paginatedResults = localResults.slice(offset, offset + limit);
  return {
    results: paginatedResults,
    source: "local",
    totalCount: localResults.length,
    fallbackReason,
  };
}

/**
 * Get all available categories in the registry
 */
export async function getCategories(): Promise<string[]> {
  const files = await glob("*/", {
    cwd: REGISTRY_ROOT,
  });

  // Remove trailing slashes
  return files.map((file) => file.replace(/\/$/, ""));
}

/**
 * List all tools in a category
 */
export async function listToolsInCategory(category: string): Promise<ToolDefinition[]> {
  const categoryPath = resolve(REGISTRY_ROOT, category);
  const files = await glob("**/*.{yaml,yml}", {
    cwd: categoryPath,
    absolute: true,
  });

  const tools: ToolDefinition[] = [];
  for (const file of files) {
    const tool = await loadToolDefinition(file);
    if (tool) {
      tools.push(tool);
    }
  }
  return tools;
}

/**
 * Get a specific tool by name (for full schema retrieval)
 */
export async function getToolByName(toolName: string): Promise<ToolDefinition | null> {
  // Search all YAML files in registry
  const files = await glob("**/*.{yaml,yml}", {
    cwd: REGISTRY_ROOT,
    absolute: true,
  });

  for (const file of files) {
    const tool = await loadToolDefinition(file);
    if (tool && tool.name === toolName) {
      return tool;
    }
  }

  return null;
}

/**
 * Disconnect the registry Serena client (for cleanup)
 */
export async function disconnectRegistrySerena(): Promise<void> {
  if (registrySerena) {
    try {
      await registrySerena.close();
      console.error("Registry Serena disconnected");
    } catch (error) {
      console.error("Error disconnecting registry Serena:", error);
    }
    registrySerena = null;
  }
}
