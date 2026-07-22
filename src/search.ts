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

/** Search result from tool search */
export interface SearchResult {
  tool: ToolDefinition;
  score: number;
  matchContext?: string;
}

/** Search response */
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

/** Dedicated Serena client for registry search (separate from sandbox) */
let registrySerena: Client | null = null;

/** Track in-flight connection promise to avoid duplicate connections */
let connectionPromise: Promise<Client | null> | null = null;

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
 * Serena MCP server is launched via `uvx --from <pkg> <entrypoint> <command>`. The package pin
 * lives in this single spec builder so transport details stay discoverable in one place and can be
 * exercised without spawning a process.
 */
const SERENA_PACKAGE = "git+https://github.com/oraios/serena";
const SERENA_ENTRYPOINT = "serena";
const SERENA_MCP_SERVER_COMMAND = "start-mcp-server";

/**
 * Build the stdio transport spec for launching the Serena MCP server. Pure: no I/O, no globals read
 * beyond `process.env` passed by reference.
 */
export const buildSerenaTransportSpec = (): SerenaTransportSpec => ({
  command: "uvx",
  args: ["--from", SERENA_PACKAGE, SERENA_ENTRYPOINT, SERENA_MCP_SERVER_COMMAND],
  env: process.env as Record<string, string>,
});

/**
 * Represents an error that can occur while connecting to or interacting with the Serena registry.
 *
 * This is a discriminated union of error variants, where each variant is identified by its `tag`
 * property. The `cause` field holds the underlying error or reason that triggered the failure, and
 * may be of any type.
 */
type RegistrySerenaConnectError =
  | { readonly tag: "connect_failed"; readonly cause: unknown }
  | { readonly tag: "activate_project_failed"; readonly cause: unknown };

/**
 * Represents the outcome of a registry Serena connection attempt.
 *
 * This is a discriminated union indicating either a successful connection, in which case the
 * resulting {@link Client} is provided, or a failed connection, in which case the corresponding
 * {@link RegistrySerenaConnectError} describing the failure is returned.
 *
 * Consumers should narrow on the `ok` field to safely access the type-specific payload.
 */
type RegistrySerenaConnectResult =
  | { readonly ok: true; readonly client: Client }
  | { readonly ok: false; readonly error: RegistrySerenaConnectError };

/**
 * Returns the singleton Serena registry client, establishing a connection on first call.
 *
 * If a client instance already exists, it is returned immediately. If a connection attempt is
 * currently in progress, the returned promise resolves with the outcome of that ongoing attempt,
 * preventing duplicate concurrent connections. Otherwise, a new connection is initiated and the
 * resulting client (or `null` on failure) is cached for subsequent calls.
 *
 * @returns A promise that resolves to the connected `Client` instance, or `null` if the connection
 *   attempt fails.
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
  connectionPromise = connectRegistrySerena().then((result) => {
    if (result.ok) {
      registrySerena = result.client;
      return result.client;
    }
    return null;
  });
  try {
    return await connectionPromise;
  } finally {
    connectionPromise = null;
  }
}

/**
 * Connect to the registry Serena MCP server and activate the registry project. Returns a tagged
 * result; the caller (typically `getRegistrySerena`) decides whether to retain the client. Pure
 * with respect to module state: does not assign to `registrySerena` itself.
 */
export async function connectRegistrySerena(): Promise<RegistrySerenaConnectResult> {
  const client = new Client(
    { name: "claudikins-registry-search", version: MCP_CLIENT_VERSION },
    { capabilities: {} },
  );

  try {
    await client.connect(new StdioClientTransport(buildSerenaTransportSpec()));
  } catch (cause) {
    console.error("Failed to connect registry Serena:", cause);
    return { ok: false, error: { tag: "connect_failed", cause } };
  }

  try {
    await client.callTool({
      name: "activate_project",
      arguments: { project: REGISTRY_ROOT },
    });
  } catch (cause) {
    console.error("Failed to activate registry project:", cause);
    return { ok: false, error: { tag: "activate_project_failed", cause } };
  }

  console.error("Registry Serena connected and project activated");
  return { ok: true, client };
}

/**
 * Escapes regex metacharacters in a single search term so the term can be embedded into a lookahead
 * pattern without altering its literal meaning.
 *
 * @param {string} term - Raw search term, may contain any character.
 * @returns {string} The term with regex metacharacters (`.*+?^${}()|[]\`) escaped.
 */
export const escapeRegexTerm = (term: string): string =>
  term.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/**
 * Splits a free-text search query into individual terms on whitespace, discarding empty fragments.
 * Whitespace-only input yields `[]`.
 *
 * @param {string} query - Free-text query string.
 * @returns {string[]} Non-empty term fragments in original order.
 */
export const tokenizeQuery = (query: string): string[] => query.split(/\s+/).filter(Boolean);

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
 * Matches substrings of the form `<category>/<server>/<file>.yaml` (or `.yml`), case-insensitive.
 * Returns an empty array if no matches.
 *
 * @param {string} text - Free-text snippet (e.g., one item from a Serena response).
 * @returns {string[]} Matched path substrings in source order, possibly empty.
 */
export const extractRegistryPaths = (text: string): string[] =>
  text.match(/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[^\s:]+\.ya?ml/gi) ?? [];

/**
 * Deduplicates a list of file paths while preserving first-occurrence order.
 *
 * @param {string[]} paths - Possibly duplicated file paths.
 * @returns {string[]} The same paths with later duplicates removed.
 */
export const dedupePaths = (paths: string[]): string[] => {
  const seen = new Set<string>();
  return paths.filter((path) => (seen.has(path) ? false : seen.add(path)));
};

/** Load a tool definition from a YAML file */
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
 * Resolves a registry-relative path against REGISTRY_ROOT, loads its ToolDefinition, and packages
 * it as a SearchResult. Returns null if the file cannot be loaded.
 *
 * @param {string} match - Path relative to the registry root.
 * @param {string} contextText - Source text from which the match was discovered; truncated to
 *   MATCH_CONTEXT_CHARS for the SearchResult.matchContext field.
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
 * Searches the registry using the Serena tool by tokenizing the query, building a lookahead regex
 * pattern, and invoking the underlying search_for_pattern capability with surrounding context.
 *
 * Results are deduplicated by path and limited to the specified count. Each surviving match is
 * enriched through {@link loadToolResult} before being returned. Any error encountered during the
 * search is logged and results in a `null` return value.
 *
 * @param query - Raw search query to be tokenized and matched.
 * @param limit - Maximum number of results to return.
 * @returns A promise resolving to an array of search results, or `null` if the registry is
 *   unavailable, the response is empty, or an error occurs during the search.
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
 * Loads all tool definitions from YAML files located in the registry root directory.
 *
 * @returns A promise that resolves to an array of tool definitions parsed from the discovered YAML
 *   files.
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
 * Performs a local search for tools matching the given query using BM25 ranking with a fallback to
 * simple term matching across tool definitions.
 *
 * @param {string} query - The search query string to match against tool definitions.
 * @param {number} limit - The maximum number of results to return.
 * @returns {Promise<SearchResult[]>} A promise that resolves to an array of search results sorted
 *   by relevance score.
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

/** Get all available categories in the registry */
export async function getCategories(): Promise<string[]> {
  const files = await glob("*/", {
    cwd: REGISTRY_ROOT,
  });

  // Remove trailing slashes
  return files.map((file) => file.replace(/\/$/, ""));
}

/** List all tools in a category */
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

/** Get a specific tool by name (for full schema retrieval) */
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

/** Disconnect the registry Serena client (for cleanup) */
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
