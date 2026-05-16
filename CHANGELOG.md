# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.3] - 2026-05-16

### Changed

- Yarn `nodeLinker` switched from default `pnp` to `pnpm`. The MCP server entry points (`dist/index.js`, `dist/cli.js`) are launched directly with `node` by MCP hosts and `npx` consumers, bypassing the PnP loader. Under PnP this broke module resolution for externalised dependencies (`dotenv`, `@modelcontextprotocol/sdk`, ...); under the pnpm linker a real `node_modules/` tree backed by hardlinks is materialised and vanilla `node` resolves the graph with no loader required. `enableScripts: true` added to ensure native postinstalls (esbuild, fsevents, lightningcss, rolldown) still run. No consumer-facing behaviour changes; the published package shape is unchanged.

### Removed

- PnP runtime artefacts: `.pnp.cjs`, `.pnp.loader.mjs`
- Yarn editor SDKs at `.yarn/sdks/` (the TypeScript shim referenced `pnpapi`, which no longer exists under the pnpm linker; editors fall through to `node_modules/typescript` natively)

## [1.1.2] - 2026-05-16

### Fixed

- `tsup` entry-point map was missing `config`, `search`, `types`, and `sandbox/{clients,runtime,workspace}`; with `bundle: true` + `splitting: true`, those modules were melted into anonymous shared chunks instead of shipping as first-class `dist/*.js` files. Callers (`te-doctor`, `te-config`, `te-guide`, `tool-executor-guide`) all reference the missing artefacts. Declared each as a named entry so `node --check dist/config.js` and siblings now resolve.

## [1.1.1] - 2026-05-16

### Fixed

- `yarn tchk` now passes: relaxed type narrowing in test mocks for overloaded `fs/promises.readFile`, `glob`, and `Buffer` signatures (TypeScript 6.x)
- `yarn test:unit` no longer surfaces phantom failures from `.stryker-tmp/` sandboxes; script switched from shell-glob expansion to a directory argument
- Stray comma-slash typo in `package.json` dependencies block

### Added

- `vitest.config.ts` with explicit include/exclude blocking `.stryker-tmp/`, `dist/`, and `node_modules/` from test runs

### Removed

- Stale `reports/mutation/mutation.html` mutation-testing artefact

## [1.1.0] - 2026-05-11

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
