/**
 * Context management constants - AGGRESSIVE limits to minimize context usage
 */
// Maximum characters to return in console.log output (keep minimal!)
export const MAX_LOG_CHARS = 500;

// Per-log-entry display budget AND the threshold at which an MCP response is
// considered large enough to spill to the workspace as a `_savedTo` file. The
// two uses share this value deliberately — both answer "what's the cutoff
// between 'small enough to keep inline' and 'too large to inline'?". If the
// display budget and the spill threshold ever need to diverge, split this into
// two named constants rather than introducing a second magic 200 anywhere.
export const MAX_LOG_ENTRY_CHARS = 200;

// Directory for auto-saved MCP responses
export const MCP_RESULTS_DIR = "mcp-results";

// MCP protocol client version reported by this server when it acts as a
// client of other MCP servers. Intentionally distinct from the project's
// package.json `version` (the two strings happen to differ today; do not
// unify without coordinating an MCP-client-version bump).
export const MCP_CLIENT_VERSION = "1.1.0";

// Maximum characters of source text included in a search match-context excerpt
export const MATCH_CONTEXT_CHARS = 200;

// Decay applied per rank position when synthesising scores for BM25 results
export const BM25_RANK_DECAY = 0.01;

// Score assigned to Serena search-graph results, which lack native scoring
export const DEFAULT_SEARCH_SCORE = 1.0;
