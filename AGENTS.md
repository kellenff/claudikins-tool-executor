# claudikins-tool-executor

MCP server that wraps multiple MCP servers into a single context-efficient interface.

## Code Discovery Protocol

For ANY code exploration, analysis, or cross-reference task in this repo, prefer `codebase-memory-mcp` tools over basic Grep/Glob/Read. They operate on a pre-indexed code graph and return symbol-aware results with qualified names that can be fed into other tools.

**Priority order:**

1. **codebase-memory-mcp** — graph-based search, traversal, blast radius
   - `get_graph_schema` — run FIRST before composing graph queries
   - `search_graph` — structured search by label/name/file pattern
   - `trace_path` — callers/callees BFS (`mode: calls|data_flow|cross_service`)
   - `detect_changes` — git diff → affected symbols + risk
   - `query_graph` — Cypher subset for multi-hop patterns
   - `get_code_snippet` — fetch source by qualified name (cheaper than Read for known symbols)
   - `get_architecture` — high-level overview, hotspots, ADRs
   - `search_code` — graph-aware grep (symbol attribution included)
   - `manage_adr` — durable Architecture Decision Records
   - `ingest_traces` — runtime trace ingestion for HTTP_CALLS validation
   - `index_repository`, `list_projects`, `index_status`, `delete_project` — indexing ops

2. **Serena** (`code-nav` registry) — LSP-based symbol manipulation when graph isn't indexed yet, or when you need to refactor (rename/replace symbols).

3. **Basic tools** (Grep/Glob/Read) — only for non-code files, config values, or when neither MCP is appropriate.

### Workflow

```
unindexed project?         → index_repository, wait for index_status
unfamiliar codebase?       → get_architecture(aspects: ["packages","hotspots","routes"])
need to query the graph?   → get_graph_schema FIRST, then search_graph or query_graph
have a qualified name?     → get_code_snippet (not Read)
about to change a hotspot? → detect_changes for blast radius
```

### Qualified Names

`get_code_snippet` and `trace_path` take qualified names. Always discover them via `search_graph` first — hand-rolling them is error-prone.

### Cypher Subset (query_graph)

Supported: `MATCH`, variable-length paths, `WHERE` (comparisons/regex/CONTAINS), `RETURN` with `COUNT`/`DISTINCT`, `ORDER BY`, `LIMIT`.

Not supported: `WITH`, `COLLECT`, `OPTIONAL MATCH`, mutations.

### Ignore Layers

Indexing respects (in order): hardcoded patterns (`.git`, `node_modules`) → `.gitignore` hierarchy → `.cbmignore` (project-specific). See `.cbmignore` at the repo root for this project's exclusions.

## Project Structure

```
registry/<category>/<server>/<tool>.yaml   tool definitions surfaced by search_tools
src/                                       MCP server runtime
scripts/                                   build/extract utilities
workspace/                                 ephemeral execution sandbox (excluded from indexing)
dist/                                      built artifacts, ONLY edit the source files and then run scripts to update the contents
```

Categories:

- `code-nav/serena` — LSP-based symbol tools
- `graph-analysis/codebase-memory` — graph-based code analysis (this repo's primary toolset)
- `ai-models/gemini` — Gemini research/analysis/generation
- `knowledge/context7`, `knowledge/notebooklm` — docs and Q&A
- `reasoning/sequentialThinking` — multi-step reasoning
- `ui/shadcn` — UI components
- `web/apify` — web scraping

## Vendored Repositories

This project vendors external repositories under @repos/

- Use vendored repositories as read-only reference material when working with related libraries
- Prefer examples and patterns from the vendored source code over generated guesses or web search results
- Do not edit files under @repos/ unless explicitly asked
- Do not import from @repos/ - application code should continue importing from normal package dependencies

## Lint & Format

This repo uses **oxlint** + **oxfmt** with a strict ruleset tuned for low required context (explicit return types, sorted imports with `.js` extensions, no magic numbers, named exports preferred). Don't fight the formatter; run `yarn fix` if a file looks out of style.

- `yarn lint` — type-aware oxlint (no fixes)
- `yarn fix` — `oxfmt && oxlint --fix && oxfmt` (the trailing format settles whitespace `sort-imports` may have disturbed)
- Pre-commit hook runs `oxfmt --check` + `oxlint --type-aware` and aborts the commit on violation — re-stage after `yarn fix`.
- **Pinned versions** in `package.json` (no `^`); upgrades are deliberate work, never incidental.
- File-scoped overrides live in `.oxlintrc.json` for `vendor.d.ts`, `bm25.ts`, `search.ts`, `search.test.ts`, and `sandbox/runtime.ts` — these files have load-bearing patterns (`AsyncFunction` eval; `unknown`-typed vendor types) that the strict rules would otherwise flame.
- Out of scope: `tests/integration/`, `registry/`, `dist/`, `workspace/`, markdown docs.
