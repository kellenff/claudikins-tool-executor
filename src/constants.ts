/** Context management constants - AGGRESSIVE limits to minimize context usage */
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

// --- Time unit primitives ---
// Expressed as compositions of these to keep magic-number violations local.
const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;
const MS_PER_HOUR = MINUTES_PER_HOUR * MS_PER_MINUTE;

// Maximum characters in a one-line summary excerpt before it gets truncated
export const MAX_ONE_LINER_CHARS = 80;

// Reserved characters for the truncation ellipsis ("...") appended after a
// one-liner is sliced down to MAX_ONE_LINER_CHARS - ONE_LINER_ELLIPSIS_RESERVE
export const ONE_LINER_ELLIPSIS_RESERVE = 3;

// Maximum characters of a serialised MCP result included as a fallback
// preview when auto-saving to the workspace fails
export const MAX_PREVIEW_FALLBACK_CHARS = 1_000;

// Default age cutoff for cleaning up auto-saved MCP result files (1 hour)
export const DEFAULT_MCP_RESULTS_MAX_AGE_MS = MS_PER_HOUR;

// Minimum Node.js major version required by the CLI doctor command
export const MIN_NODE_MAJOR_VERSION = 18;

// Default page size returned by searchTools when the caller omits `limit`
export const DEFAULT_SEARCH_LIMIT = 10;

// Default upper bound on results returned by the search_tools MCP tool
export const SEARCH_TOOLS_MAX_LIMIT = 50;

// Default page size advertised by the search_tools MCP tool schema
export const SEARCH_TOOLS_DEFAULT_LIMIT = 5;

// Lower bound (ms) on execute_code timeout — 1 second
export const EXECUTE_CODE_MIN_TIMEOUT_MS = MS_PER_SECOND;

// Upper bound (ms) on execute_code timeout — 10 minutes
const EXECUTE_CODE_MAX_TIMEOUT_MINUTES = 10;
export const EXECUTE_CODE_MAX_TIMEOUT_MS = EXECUTE_CODE_MAX_TIMEOUT_MINUTES * MS_PER_MINUTE;

// Default (ms) execute_code timeout — 30 seconds
const EXECUTE_CODE_DEFAULT_TIMEOUT_SECONDS = 30;
export const EXECUTE_CODE_DEFAULT_TIMEOUT_MS = EXECUTE_CODE_DEFAULT_TIMEOUT_SECONDS * MS_PER_SECOND;

// Idle threshold before an MCP client connection is closed by the lifecycle
// manager (3 minutes)
export const CLIENT_IDLE_TIMEOUT_MS = 3 * MS_PER_MINUTE;

// Interval between idle-client cleanup sweeps (1 minute)
export const CLIENT_CLEANUP_INTERVAL_MS = MS_PER_MINUTE;

// Maximum number of MCP-call audit log entries retained in memory
export const AUDIT_LOG_MAX_ENTRIES = 1_000;

// Default number of audit log entries returned by getAuditLog
export const AUDIT_LOG_DEFAULT_LIMIT = 100;
