# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- New `graph-analysis` registry category with 14 codebase-memory-mcp tools (indexing, graph queries, traversal, ADRs, runtime trace ingestion)
- `.cbmignore` excluding build artefacts and ephemeral state from graph indexing
- codebase-memory-mcp default sandbox client exposed as `codebase_memory` and through `clients["codebase-memory"]`

### Changed

- Custom server config now accepts arbitrary command binaries instead of only `npx`, `uvx`, `node`, or `python`

### Fixed

- Registry examples for hyphenated server names now use JavaScript-safe sandbox bindings

## [1.0.1] - 2026-01-20

### Fixed

- Hook scripts now executable (session-start.sh, search-tools-activation.sh)
- UserPromptSubmit matcher changed from invalid `*` to valid `.*` regex
- Agent field renamed from `whenToUse` to `description` (spec compliance)
- Standardized plugin.json metadata format

## [1.0.0] - 2026-01-14

### Added

- Initial release
- 3-tool interface: search_tools, get_tool_schema, execute_code
- Semantic search over 102 tool definitions (Serena-powered with BM25 fallback)
- Sandboxed TypeScript execution with pre-connected MCP clients
- Workspace API for file operations
- 7 example MCP servers (96 tools)
- Context reduction from ~25% to 0.5% of context window
