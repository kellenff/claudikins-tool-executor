# Effect FP refactor with Zod MCP edge + `effect.Schema` adapter

**Date:** 2026-07-24  
**Status:** Design — awaiting review  
**Replaces:** `docs/snowball/specs/2026-07-23-zod-to-effect-schema-design.md` (declined merge; Effect Schema as SoT for MCP tools)  
**Scope:** Restore Zod for MCP tool inputs; add Zod → `effect.Schema` adapter; adopt Effect runtime (`Effect.gen`, tagged errors, Layers, `ManagedRuntime`) across config, search, tools, sandbox, CLI — phased PRs  
**Out of scope:** `@effect/schema` package; structural Zod AST → Schema tree converter; changing registry YAML format; eliminating transitive Zod from the MCP SDK install tree

## Context

The 2026-07-23 port made Effect `Schema` the application SoT for tool inputs and config, removed direct Zod, and bypassed `McpServer.registerTool` via a custom `tools/list` + `tools/call` registrar. That merge was declined.

This design **replaces that work completely**:

- Zod remains the SoT for the three MCP tool input schemas so `registerTool` works again.
- An adapter produces `effect.Schema` (from `"effect"`, **not** `@effect/schema`) for Effect-side decode.
- Config stays on native `effect.Schema` (never hits `registerTool`).
- The app adopts full-stack Effect: Layers + `@effect/platform` / `@effect/platform-node`, with a process-lifetime `ManagedRuntime`.

Chorus debate (`.brainstorm/chorus-effect-fp-approaches.json`) favored thin adapter + `ManagedRuntime` over per-request `provide` or a structural AST converter. Requirement: the adapter must run the **full** Zod pipeline (refine / transform / brand / lazy), not a shape-only guard.

## Goals

1. MCP tools register via Zod `inputSchema` on `McpServer.registerTool`.
2. Effect programs decode tool inputs through adapted `effect.Schema` with Schema/`ParseResult`-shaped failures in `E`.
3. Config validation uses native `effect.Schema` and loads as an Effect (platform FS where appropriate).
4. Domain I/O is modeled as `Context.Tag` services composed into `AppLive`; process edge uses `ManagedRuntime`.
5. Sandbox orchestration is Effect-native; only `AsyncFunction` eval is an `Effect.tryPromise` impurity.
6. Delivery is phased (see Delivery); each phase keeps unit tests green.
7. Pinned dependencies (no incidental `^`); no `@effect/schema`.

## Non-goals

- Making Effect Schema the SoT for MCP tool listing/validation.
- Hand-maintaining parallel Zod and Effect Schema trees for tools (adapter is the bridge).
- Removing Zod from transitive deps of `@modelcontextprotocol/sdk`.
- Behavior changes beyond error-channel shaping; preserve user-visible strings locked by tests unless deliberately updated in the same PR.

## Decision

**Approach A: Thin Zod → `effect.Schema` bridge + process-lifetime `ManagedRuntime` + platform Layers.**

1. Re-add direct pinned `zod`; restore Zod tool schemas and `registerTool`.
2. Prefer a community Effect4 + Zod4 bridge if one exists and fits; otherwise implement `schemaFromZod` that decodes via full `zod.parse` / `safeParse` into Schema issues.
3. Keep config on native `effect.Schema`.
4. Add pinned `@effect/platform` + `@effect/platform-node` aligned with `effect@4.0.0-beta.101`.
5. Build `AppLive` + `ManagedRuntime`; tool handlers call `runtime.runPromise(...)`.
6. Delete `register-tools.ts` / `registerEffectTools` in phase 1 — custom Effect registrar is not the MCP path.

Do **not** pass adapted Effect schemas into `registerTool` — the SDK requires Zod.

## Architecture

```text
                    ┌─────────────────────────────────────────┐
  MCP SDK           │  Zod tool schemas (SoT for tools)       │
  registerTool ────►│  inputSchema: z.ZodType                 │
                    └───────────────┬─────────────────────────┘
                                    │ schemaFromZod (adapter)
                                    ▼
                    ┌─────────────────────────────────────────┐
  Effect programs   │  effect.Schema decode (full Zod pipeline)│
                    │  Effect.gen handlers                     │
                    └───────────────┬─────────────────────────┘
                                    │ ManagedRuntime.runPromise
                    ┌───────────────▼─────────────────────────┐
  Process lifetime  │  AppLive Layer                           │
                    │  platform-node FS/Command + domain Tags  │
                    │  (Config, McpClients, Search, Sandbox…)  │
                    └─────────────────────────────────────────┘

  config files ──► native effect.Schema (not Zod)
  AsyncFunction ──► Effect.tryPromise only (eval impurity)
```

**Baseline:** treat the declined port as gone for the target design — restore Zod + `registerTool` as Phase 0/1 starting point even if local branch still contains Effect-Schema-SoT commits.

## Components

| Piece | Responsibility |
| --- | --- |
| `src/schemas.ts` | Zod SoT for `search_tools`, `get_tool_schema`, `execute_code`; export Zod for `registerTool`; export adapted `effect.Schema` + inferred types |
| `src/zod-effect.ts` | `schemaFromZod`: community bridge if compatible, else Schema decode via full Zod pipeline |
| `src/config.ts` | Native `effect.Schema` for server/config; load as Effect |
| `src/layers/*` | `AppLive`: Node platform + `Config`, MCP clients, `Search`, `Workspace`, `Sandbox` Tags |
| `src/runtime.ts` | Process `ManagedRuntime` make/dispose for `main` and tests |
| `src/index.ts` | `McpServer` + Zod `registerTool`; handlers → `runtime.runPromise(toolEffect)` |
| `src/register-tools.ts` | Delete in phase 1 — replaced by Zod `registerTool` |
| `src/tools/*` | Handlers as `Effect` programs requiring domain services |
| `src/search.ts` | Effectify Serena + local fallback behind `Search` |
| `src/sandbox/*` | Clients / workspace / runtime as Layers; eval via `Effect.tryPromise` |
| `src/cli.ts` | CLI actions as Effects via same (or CLI-scoped) runtime |

### Adapter contract

`schemaFromZod(zod): Schema<A, unknown>` such that `Schema.decodeUnknown(schema)(input)` runs the full Zod pipeline. MCP never receives the adapted schema — only Zod.

Community packages (e.g. `@zod-plugin/effect`) must be evaluated against Effect 4 Schema + Zod 4; if they only wrap parse as `Effect` without yielding `effect.Schema`, or peer on Effect 3 / Zod 3 only, fall back to the in-repo adapter.

## Data flow

### Tool call

```text
MCP tools/call
  → SDK validates args with Zod inputSchema (registerTool)
  → handler
  → Schema.decodeUnknown(adaptedSchema)(args)   // Effect entry; full Zod pipeline
  → Effect.gen tool program (services from ManagedRuntime)
  → CallToolResult
  ← runtime.runPromise(...)
```

**Decode policy:** Re-decode via adapted `effect.Schema` at the Effect entry so programs stay Schema-native in `E` and brands/refines are not `as`-cast past the boundary. SDK Zod remains required for `registerTool`. Re-decode must be idempotent for our tool schemas (defaults/strictness) so double validation (SDK then adapter) does not change values.

### Config

```text
platform FileSystem read → JSON.parse → env expand
  → Schema.decodeUnknown(ToolExecutorConfigSchema)
  → Config service in Layer
```

### Sandbox execute

```text
execute_code Effect
  → Sandbox.execute(code, timeout)
  → acquire clients / workspace via Tags
  → Effect.tryPromise(AsyncFunction eval) + timeout
  → ExecutionResult / tagged errors
```

### Startup / shutdown

```text
main: build AppLive → ManagedRuntime.make → register tools → connect transport
signal: runtime.dispose → disconnect MCP clients, workspace cleanup
```

## Error handling

Tagged errors in the Effect `E` channel (not raw throws inside programs):

| Tag | Where | Maps to |
| --- | --- | --- |
| Schema / adapter-mapped Zod issues | tool & config decode | MCP `InvalidParams` or startup fail |
| `ConfigError` | missing/invalid config | CLI/startup exit |
| `McpClientError` | connect/call failures | tool `isError` or search fallback |
| `SearchError` | Serena/local failures | preserve null-fallback / message parity |
| `SandboxTimeout` / `SandboxEvalError` | execute_code | tool error result |
| `WorkspaceError` | path traversal / FS | tool error result |

**Edge policy**

- Tool handlers: `runtime.runPromise(effect.pipe(Effect.catchTags(...)))` → `CallToolResult` or rethrow `McpError` when the SDK expects protocol errors.
- Config/CLI: run failure → non-zero exit + message (same UX as today).
- Defects: log + generic tool error; do not leak stacks to MCP clients unless tests already require it.

Preserve user-visible strings covered by unit tests unless deliberately changed in the same PR.

## Testing

- Vitest remains the runner; add `@effect/vitest` pinned to the same Effect 4 beta line where useful; otherwise use `ManagedRuntime` / `Effect.runPromiseExit`.
- Adapter tests: success/failure for each tool Zod schema; defaults, strictness, refine; issues map to readable Schema failures.
- Layer tests: test Layers (in-memory FS / fake MCP clients) for search, config, sandbox orchestration.
- MCP edge: `registerTool` accepts Zod `inputSchema`; invalid args still surface validation errors.
- Existing behavioral tests are the contract; update imports/assertions as modules Effectify.
- Phase gates: `yarn test:unit` (and lint/typecheck for touched files) green before merging each phase.

## Delivery

Phased PRs (blast-radius at design time: heuristic backend, high change scope — split required):

1. **MCP edge restore:** re-add Zod, restore Zod schemas + `registerTool`, add `schemaFromZod`, delete `register-tools.ts`.
2. **Effectify core:** pure/core modules and config decode as Effect (still thin I/O).
3. **Layers + runtime:** platform FS/Command, MCP clients, workspace, sandbox orchestration, `ManagedRuntime`.
4. **CLI / main launch:** process lifecycle as Layer/`ManagedRuntime` dispose on signals.

## Dependencies

| Package | Action |
| --- | --- |
| `effect` | Keep pinned `4.0.0-beta.101` (or deliberate bump of whole Effect line together) |
| `zod` | Re-add as direct dependency, pinned (no `^`) to a Zod 4.x version accepted by `@modelcontextprotocol/sdk` (resolve exact version at implement time via lockfile / SDK peer range) |
| `@effect/platform` | Add, pinned to Effect 4 beta-compatible release |
| `@effect/platform-node` | Add, same pin line |
| `@effect/vitest` | Add when Effect tests need it; same pin line |
| `@effect/schema` | **Do not add** |

## Success criteria

- [ ] Three tools registered with Zod via `registerTool`
- [ ] No custom Effect-only MCP registrar as the production path
- [ ] Tool Effect programs decode via adapted `effect.Schema` (full Zod pipeline)
- [ ] Config uses native `effect.Schema` + Effect load path
- [ ] `AppLive` + `ManagedRuntime` own process I/O services
- [ ] Sandbox eval is the only intentional `AsyncFunction` impurity behind `tryPromise`
- [ ] No `@effect/schema`; no `from "@effect/schema"` under `src/`
- [ ] Unit tests + typecheck/lint pass at each phase gate

## Alternatives considered

| Approach | Verdict |
| --- | --- |
| **A** Thin Zod→`effect.Schema` + `ManagedRuntime` | **Chosen** — matches pooling/finalizers; adapter sufficient for three tool schemas |
| **B** Thin adapter + per-request `Effect.provide(AppLive)` | Rejected — recreates resources; weak finalizers |
| **C** Structural Zod AST → Effect Schema tree | Rejected — dual trees; no solid Effect4+Zod4 package; overkill |
| Effect Schema SoT + custom registrar (2026-07-23) | Declined merge; superseded by this design |
