# Port Zod validation to Effect `Schema`

**Date:** 2026-07-23  
**Status:** Design — awaiting review  
**Scope:** `src/schemas.ts`, `src/config.ts`, new `src/register-tools.ts`, `src/index.ts` (wire-up only), matching unit tests, `package.json` / lockfile  
**Out of scope:** Adopting Effect runtime (`Effect.gen`, Layers, services) beyond Schema decode; sandbox/handlers behavior changes; removing transitive Zod pulled by `@modelcontextprotocol/sdk`; `@effect/schema` package

## Context

Zod is used in exactly two application modules:

- `src/schemas.ts` — input schemas for `search_tools`, `get_tool_schema`, and `execute_code`
- `src/config.ts` — `ServerConfig` / `ToolExecutorConfig` for layered JSON config files

`src/index.ts` passes those Zod objects to `McpServer.registerTool({ inputSchema })`. The MCP SDK’s high-level path **requires Zod**: it rejects non-Zod `inputSchema` values and validates `tools/call` arguments with Zod’s parse helpers. Protocol framing schemas inside the SDK may still depend on Zod as a transitive/optional peer; that is acceptable.

The project does not list `effect` today. Dependency versions are pinned deliberately (no incidental `^` upgrades). Vendored Effect under `repos/effect/` documents `Schema` from `"effect"` (v4-style API: `decodeUnknownSync`, `toJsonSchemaDocument`) — **not** the legacy `@effect/schema` package.

## Goals

1. Effect `Schema` (from `"effect"`) is the only application source of truth for validation and inferred types.
2. No `zod` entry in our `package.json` and no `zod` imports under `src/`. Transitive copies via other packages are fine if unused by our code.
3. MCP clients still see accurate JSON Schema (descriptions, defaults, closed objects where we use `.strict()` today).
4. Validation stays **sync and throwing**, matching today’s `.parse()` call-site style.
5. Handler signatures and config load semantics stay behaviorally equivalent.

## Decision

**Approach: Effect Schema source of truth + custom tool registration on the underlying `Server`.**

1. Add a pinned `effect` dependency; remove `zod` from our direct dependencies.
2. Rewrite config and tool input schemas with `Schema` from `"effect"`.
3. Validate with `Schema.decodeUnknownSync` (throw on failure).
4. Stop using `McpServer.registerTool` for the three tools. Keep `McpServer` for transport/lifecycle; register `tools/list` and `tools/call` on the underlying `Server` so we can advertise JSON Schema from `Schema.toJsonSchemaDocument` and decode with Effect.

Do **not** pass Effect schemas or generated JSON Schema objects into `registerTool` — the SDK will throw.

## Architecture

```text
                    ┌─────────────────────┐
  config files ───► │ Effect Schema       │── decodeUnknownSync ──► LoadedServer[]
                    │ (config.ts)         │
                    └─────────────────────┘

  MCP tools/list ─► JSON Schema from Schema.toJsonSchemaDocument(toolSchemas)
  MCP tools/call ─► decodeUnknownSync(toolSchema) ─► existing handlers
```

No broader Effect runtime adoption in this change.

## Components

| Piece | Responsibility |
| --- | --- |
| `src/schemas.ts` | Effect schemas for the three tool inputs; exported types via Schema type inference; optional thin `parse*` helpers wrapping `decodeUnknownSync` for test/call-site convenience |
| `src/config.ts` | Effect schemas for server/config objects; `loadConfig` swaps Zod `.parse()` for `decodeUnknownSync` |
| `src/register-tools.ts` (new) | Table of `{ name, meta, schema, handler }`; installs `tools/list` + `tools/call` on `mcpServer.server` once; builds JSON Schema docs at startup. `src/index.ts` only constructs `McpServer` and calls this registrar |
| `src/tools/*` | Unchanged; receive already-validated typed params |

### Schema parity requirements

Preserve current Zod behavior:

| Concern | Target |
| --- | --- |
| Non-empty strings | min length / non-empty checks with comparable messages where tests assert them |
| Integers + bounds | `limit`, `offset`, `timeout` ranges and defaults unchanged |
| Defaults | Applied on decode the same way `.default()` does today |
| Descriptions | Field annotations that appear in generated JSON Schema for MCP listing |
| Strict objects | Tool input objects and top-level config reject unknown keys (`additionalProperties: false` / equivalent Effect checks) |
| Server config records | `env` as string→string map; optional fields remain optional |

JSON Schema generation: `Schema.toJsonSchemaDocument(schema, options)` with options that keep objects closed where required and preserve `description` / `default`.

## Data flow

**Tool call**

```text
tools/call { name, arguments }
  → lookup registration
  → Schema.decodeUnknownSync(schema)(arguments)   // throws on invalid
  → handler(validated)
  → CallToolResult
```

**Config**

```text
read file → JSON.parse → env expand → decodeUnknownSync(ToolExecutorConfigSchema)
```

**Tool list**

```text
tools/list → [{ name, title, description, inputSchema: jsonSchema, annotations, ... }]
```

## Error handling

- Stay throw-based at validation boundaries (`decodeUnknownSync`).
- Custom `tools/call` path catches decode failures and returns an MCP tool/invalid-params error with a readable message (same user-visible class of failure as today’s SDK Zod path).
- Config load continues to throw and fail CLI/startup on invalid files.
- No new public `Either` / `Effect` error surfaces in this port.

## Testing

- Update `src/schemas.test.ts` and `src/config.test.ts` to use Effect decode helpers instead of Zod `.parse()` / `.shape.*`.
- Assert descriptions via annotations or generated JSON Schema, not Zod `.shape`.
- Keep behavioral cases: empty strings, bounds, defaults, unknown keys, config merge fixtures that call parse.
- Add or extend a smoke assertion that listed tool `inputSchema` includes required properties and descriptions, and that bad `tools/call` args yield a validation error.

## Dependencies

- Add `effect` at a pinned version compatible with `Schema.decodeUnknownSync` and `Schema.toJsonSchemaDocument` (Effect 4.x Schema API as in vendored `repos/effect`).
- Remove `zod` from `package.json` dependencies.
- Do not add `@effect/schema`.
- Accept that `@modelcontextprotocol/sdk` may still list Zod as an optional peer / transitive package.

## Success criteria

- [ ] No `from "zod"` / `from 'zod'` under `src/`
- [ ] No `zod` key in our `package.json` dependencies
- [ ] Config load and tool handlers behave equivalently under existing unit tests (adapted assertions)
- [ ] MCP tool listing exposes JSON Schema derived from Effect schemas
- [ ] `yarn test:unit` and `yarn tchk` / lint pass for touched files

## Non-goals

- Replacing Promise-based handlers with `Effect` programs
- Eliminating Zod from the entire install tree (`yarn why zod` may still show SDK-related entries)
- Hand-maintaining parallel Zod mirrors “just to keep `registerTool`”
- Migrating registry YAML extraction or other non-Zod validation
