# Effect FP + Zod MCP Adapter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use snowball:subagent-driven-development (recommended) or snowball:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revert the declined Effect-Schema-SoT implementation on this branch, then implement Effect FP from that clean Zod baseline: Zod tool inputs + `registerTool`, Zod→`effect.Schema` adapter, config on native `effect.Schema`, Layers + `ManagedRuntime`.

**Architecture:** **Do not migrate forward from the declined port.** Task 1 hard-resets implementation files to pre-port git state. Then build greenfield: Zod SoT for MCP tools → `schemaFromZod` → Effect programs; config ported Zod→Effect Schema; `AppLive` + `ManagedRuntime`; sandbox eval via `Effect.tryPromise(AsyncFunction)`.

**Tech Stack:** TypeScript ESM, Vitest, `effect@4.0.0-beta.101`, `zod@4.4.3` (pinned, no `^`), `@effect/platform-node` (Effect 4 beta line; FileSystem/Path from `effect` — **not** `@effect/platform` or `@effect/schema`).

**Spec:** `docs/snowball/specs/2026-07-24-effect-fp-zod-adapter-design.md`

**Pre-port baseline commit:** `2c3b930a058e6dda74be0e251d863a2607f4b2e6` (parent of `c967d3072` “chore: add effect Schema dependency”; Zod + `registerTool`, no `effect`, no `register-tools.ts`).

## File Structure

| File | Action | Phase | Responsibility |
| --- | --- | --- | --- |
| `package.json` / `yarn.lock` | Revert then modify | 0–1, 3 | Restore pre-port deps; pin `zod`; add `effect` / later `@effect/platform-node` |
| `src/schemas.ts` / `schemas.test.ts` | Revert then modify | 0–1 | Zod tool schemas; then export adapted Effect schemas |
| `src/config.ts` / `config.test.ts` | Revert then modify | 0, 2 | Start Zod; port to native `effect.Schema` in Phase 2 |
| `src/index.ts` / `index.test.ts` | Revert then modify | 0, 4 | Zod `registerTool` baseline; later runtime lifecycle |
| `src/register-tools.ts` (+ test) | Delete (via revert) | 0 | Must not exist after Task 1 |
| `dist/**` | Rebuild | 0 | After revert, `yarn build` — do not hand-merge declined dist |
| `src/zod-effect.ts` (+ test) | Create | 1 | `schemaFromZod` |
| `src/errors.ts` (+ test) | Create | 2 | Tagged errors |
| `src/tools/*`, `src/search.ts`, `src/sandbox/*` | Modify | 2–3 | Effectify |
| `src/layers/*`, `src/runtime.ts` | Create | 3 | Tags + `AppLive` + `ManagedRuntime` |
| `src/cli.ts` | Modify | 4 | Effect CLI |
| `docs/snowball/specs/2026-07-24-*` / `plans/2026-07-24-*` | Keep | — | New design/plan — **do not revert** |

## Implementation Notes (read first)

1. **Start from scratch via revert:** Task 1 restores implementation to `2c3b930a`. Do **not** incrementally undo Effect Schema types in place. Keep the 2026-07-24 design/plan commits; discard declined port *code*.
2. **After Task 1:** Zod tool + config schemas, `registerTool`, no `effect`, no `register-tools.ts`. All later tasks assume that baseline.
3. **Pins:** No `^` on new/changed deps. After revert, replace `"zod": "^4.3.5"` with `"zod": "4.4.3"`. Add `"effect": "4.0.0-beta.101"`. Pin `@effect/platform-node` to the same beta line.
4. **Effect 4 platform:** `FileSystem` / `Path` from `"effect"`; Node layer from `@effect/platform-node`. No `@effect/platform`, no `@effect/schema`.
5. **Adapter:** Community Effect4+Zod4 → `effect.Schema` if peer-compatible; else in-repo `Schema.declareConstructor` + `zod.safeParse`. Never pass adapted schemas to `registerTool`.
6. **Double decode:** SDK Zod + Effect adapter re-decode; must be idempotent.
7. **Lint:** `yarn fix` on touched files; explicit return types; `.js` import extensions.

---

# Phase 0 — Revert declined port (implementation only)

### Task 1: Hard-reset implementation files to pre-port baseline

**Files:**
- Restore from `2c3b930a`: `package.json`, `yarn.lock`, `src/schemas.ts`, `src/schemas.test.ts`, `src/config.ts`, `src/config.test.ts`, `src/index.ts`, `src/index.test.ts`, and any other `src/**` / `dist/**` touched only by the declined port commits (`c967d3072`..`41c8021e9`)
- Delete if present: `src/register-tools.ts`, `src/register-tools.test.ts`
- **Do not** revert: `docs/snowball/specs/2026-07-24-effect-fp-zod-adapter-design.md`, `docs/snowball/plans/2026-07-24-effect-fp-zod-adapter.md`

- [ ] **Step 1: Identify declined-port paths**

Run:

```bash
git diff --name-only 2c3b930a..41c8021e9 -- package.json yarn.lock src dist
```

Expected: lists the Effect Schema port files (schemas, config, index, register-tools, package/lock, dist). Note paths for checkout.

- [ ] **Step 2: Restore implementation from baseline**

```bash
git checkout 2c3b930a -- package.json yarn.lock src/
rm -f src/register-tools.ts src/register-tools.test.ts
```

If `dist/` is tracked and was changed by the port:

```bash
git checkout 2c3b930a -- dist/
```

Or delete generated artifacts and rebuild in Step 4.

Confirm new docs remain:

```bash
test -f docs/snowball/specs/2026-07-24-effect-fp-zod-adapter-design.md
test -f docs/snowball/plans/2026-07-24-effect-fp-zod-adapter.md
```

- [ ] **Step 3: Install + sanity**

```bash
yarn install
node --input-type=module -e 'import { z } from "zod"; console.log("zod", typeof z.object); import("effect").then(() => console.log("effect SHOULD NOT resolve")).catch(() => console.log("effect absent ok"))'
rg -n "registerEffectTools|register-tools|from \"effect\"" src || true
```

Expected: Zod works; `effect` not a direct app dependency yet; no `registerEffectTools` / `from "effect"` under `src/`.

- [ ] **Step 4: Rebuild dist if needed; unit gate**

```bash
yarn build
yarn test:unit
yarn tchk
```

Expected: PASS on the restored Zod/`registerTool` codebase.

- [ ] **Step 5: Commit**

```bash
git add -A package.json yarn.lock src dist
git status   # confirm 2026-07-24 design/plan docs are NOT deleted
git commit -m "$(cat <<'EOF'
revert: restore pre-Effect-Schema-port implementation baseline

Discard the declined Zod→Effect Schema SoT port (register-tools, Effect
tool schemas). Keep 2026-07-24 Effect FP + Zod adapter design/plan docs.

EOF
)"
```

---

# Phase 1 — Add Effect + Zod→Schema adapter (from clean baseline)

### Task 2: Pin `zod` and add `effect`

**Files:**
- Modify: `package.json`
- Modify: `yarn.lock` (via yarn)

- [ ] **Step 1: Edit dependencies**

In `package.json` `dependencies`:

- Change `"zod": "^4.3.5"` → `"zod": "4.4.3"` (no caret)
- Add `"effect": "4.0.0-beta.101"`

- [ ] **Step 2: Install**

Run: `yarn install`

Expected: both packages resolve; lockfile updated.

- [ ] **Step 3: Sanity-check**

```bash
node --input-type=module -e 'import { z } from "zod"; import { Schema } from "effect"; console.log(typeof z.object, typeof Schema.declareConstructor, typeof Schema.decodeUnknownEffect);'
```

Expected: `function function function`.

- [ ] **Step 4: Commit**

```bash
git add package.json yarn.lock
git commit -m "$(cat <<'EOF'
chore: pin zod 4.4.3 and add effect for Schema adapter

EOF
)"
```

---

### Task 3: Red — adapter tests

**Files:**
- Create: `src/zod-effect.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/zod-effect.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { Effect, Exit, Schema } from "effect";
import { z } from "zod";

import { schemaFromZod } from "./zod-effect.js";

describe("schemaFromZod", () => {
  const ZodPerson = z
    .object({
      name: z.string().min(1, "name required"),
      age: z.number().int().min(0).default(0),
    })
    .strict();

  const PersonSchema = schemaFromZod(ZodPerson);

  it("decodes valid input through the full Zod pipeline (defaults)", async () => {
    const result = await Effect.runPromise(Schema.decodeUnknownEffect(PersonSchema)({ name: "ada" }));
    expect(result).toEqual({ name: "ada", age: 0 });
  });

  it("fails on invalid input", async () => {
    const exit = await Effect.runPromiseExit(
      Schema.decodeUnknownEffect(PersonSchema)({ name: "" }),
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("rejects unknown keys (strict)", async () => {
    const exit = await Effect.runPromiseExit(
      Schema.decodeUnknownEffect(PersonSchema)({ name: "ada", extra: true }),
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("runs refinements", async () => {
    const Refined = z.string().refine((s) => s.startsWith("ok-"), { message: "prefix" });
    const schema = schemaFromZod(Refined);
    await expect(Effect.runPromise(Schema.decodeUnknownEffect(schema)("ok-1"))).resolves.toBe(
      "ok-1",
    );
    const exit = await Effect.runPromiseExit(Schema.decodeUnknownEffect(schema)("bad"));
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("is idempotent for defaults (double decode)", async () => {
    const once = await Effect.runPromise(
      Schema.decodeUnknownEffect(PersonSchema)({ name: "ada" }),
    );
    const twice = await Effect.runPromise(Schema.decodeUnknownEffect(PersonSchema)(once));
    expect(twice).toEqual(once);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `yarn vitest run src/zod-effect.test.ts`

Expected: FAIL (cannot resolve `./zod-effect.js` / `schemaFromZod` missing).

- [ ] **Step 3: Commit test**

```bash
git add src/zod-effect.test.ts
git commit -m "$(cat <<'EOF'
test: add failing schemaFromZod adapter tests

EOF
)"
```

---

### Task 4: Green — implement `schemaFromZod`

**Files:**
- Create: `src/zod-effect.ts`

- [ ] **Step 1: Community bridge probe (document outcome in commit body)**

Before coding, search npm/`yarn npm info` for an Effect **4** + Zod **4** package that returns `effect.Schema` (not merely `Effect` from parse). `@zod-plugin/effect` peers Effect 3 / Zod 3 and wraps parse as Effect — **reject** it.

If nothing fits, implement the in-repo adapter below (expected path).

- [ ] **Step 2: Implement adapter**

Create `src/zod-effect.ts`:

```typescript
import { Effect, Option, Schema, SchemaIssue } from "effect";
import type { z } from "zod";

/**
 * Adapt a Zod schema into an `effect.Schema` whose decode runs the full Zod pipeline
 * (`safeParse`: refine / transform / brand / lazy / defaults / strict).
 *
 * Encoded side is `unknown` — callers pass MCP/JSON values.
 */
export function schemaFromZod<T>(zodSchema: z.ZodType<T>): Schema.Top {
  return Schema.declareConstructor<T, unknown>()(
    [],
    () => (input, ast, _options) => {
      const parsed = zodSchema.safeParse(input);
      if (parsed.success) {
        return Effect.succeed(parsed.data);
      }
      // InvalidType carries ast+actual; Zod issue text is available via parsed.error if we later
      // map to a richer SchemaIssue / Data.TaggedError at the tool edge.
      return Effect.fail(new SchemaIssue.InvalidType(ast, Option.some(input)));
    },
    {
      title: "ZodSchema",
      description: "effect.Schema adapter over Zod (full safeParse pipeline)",
    },
  );
}

/** Sync helper for call sites / tests that still want throw-on-fail. */
export function decodeZodSync<T>(zodSchema: z.ZodType<T>, input: unknown): T {
  return Schema.decodeUnknownSync(schemaFromZod(zodSchema))(input);
}
```

If `SchemaIssue.InvalidType` constructor arity differs in this beta, adjust to the nearest Issue type that accepts a message (check `SchemaIssue` exports); keep failure in `E` via `Effect.fail`.

If TypeScript complains about `Schema.Top` return, use:

```typescript
export function schemaFromZod<T>(
  zodSchema: z.ZodType<T>,
): Schema.Codec<T, unknown> {
```

…or `ReturnType`-compatible cast after verifying `decodeUnknownEffect` works in tests.

- [ ] **Step 3: Run tests — expect PASS**

Run: `yarn vitest run src/zod-effect.test.ts`

Expected: all tests PASS.

- [ ] **Step 4: Lint**

Run: `yarn fix` (or oxfmt/oxlint on the new files).

- [ ] **Step 5: Commit**

```bash
git add src/zod-effect.ts src/zod-effect.test.ts
git commit -m "$(cat <<'EOF'
feat: add Zod to effect.Schema adapter via safeParse

EOF
)"
```

---

### Task 5: Export Effect adapters from existing Zod tool schemas

**Files:**
- Modify: `src/schemas.ts`
- Modify: `src/schemas.test.ts`

After Task 1, `schemas.ts` is already the pre-port Zod SoT. Do **not** rewrite the Zod objects — only add adapter exports and keep `.parse` behavior.

- [ ] **Step 1: Extend `src/schemas.ts`**

Add imports and Effect schema exports (keep existing Zod definitions and `z.infer` types unchanged):

```typescript
import { decodeZodSync, schemaFromZod } from "./zod-effect.js";

// after each Zod schema + type:
export const SearchToolsEffectSchema = schemaFromZod(SearchToolsInputSchema);
export const GetToolSchemaEffectSchema = schemaFromZod(GetToolSchemaInputSchema);
export const ExecuteCodeEffectSchema = schemaFromZod(ExecuteCodeInputSchema);

// optional thin helpers (or call Schema.decodeUnknownSync via decodeZodSync):
export function parseSearchToolsInput(input: unknown): SearchToolsInput {
  return decodeZodSync(SearchToolsInputSchema, input);
}
export function parseGetToolSchemaInput(input: unknown): GetToolSchemaInput {
  return decodeZodSync(GetToolSchemaInputSchema, input);
}
export function parseExecuteCodeInput(input: unknown): ExecuteCodeInput {
  return decodeZodSync(ExecuteCodeInputSchema, input);
}
```

If the baseline already uses `SearchToolsInputSchema.parse` at call sites, either keep using `.parse` directly **or** switch call sites to `parse*` in the same PR — prefer keeping `.parse` in tests that assert Zod `.shape` and add `parse*` only if useful for Effect edges.

- [ ] **Step 2: Extend `src/schemas.test.ts`**

Keep existing Zod `.parse` / `.shape.description` cases. Append:

```typescript
import { Effect, Schema } from "effect";
import {
  ExecuteCodeEffectSchema,
  GetToolSchemaEffectSchema,
  SearchToolsEffectSchema,
  SearchToolsInputSchema,
  GetToolSchemaInputSchema,
  ExecuteCodeInputSchema,
} from "./schemas.js";

it("adapted Effect schemas match Zod.parse", async () => {
  const rawSearch = { query: "x" };
  const search = await Effect.runPromise(
    Schema.decodeUnknownEffect(SearchToolsEffectSchema)(rawSearch),
  );
  expect(search).toEqual(SearchToolsInputSchema.parse(rawSearch));

  const rawTool = { name: "t" };
  const tool = await Effect.runPromise(
    Schema.decodeUnknownEffect(GetToolSchemaEffectSchema)(rawTool),
  );
  expect(tool).toEqual(GetToolSchemaInputSchema.parse(rawTool));

  const rawExec = { code: "1" };
  const exec = await Effect.runPromise(
    Schema.decodeUnknownEffect(ExecuteCodeEffectSchema)(rawExec),
  );
  expect(exec).toEqual(ExecuteCodeInputSchema.parse(rawExec));
});
```

- [ ] **Step 3: Run tests**

Run: `yarn vitest run src/schemas.test.ts src/zod-effect.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/schemas.ts src/schemas.test.ts
git commit -m "$(cat <<'EOF'
feat(schemas): export effect.Schema adapters alongside Zod SoT

EOF
)"
```

---

### Task 6: Phase 1 gate

- [ ] **Step 1: Verify Phase 1 criteria**

- Implementation baseline restored (no declined registrar; Zod `registerTool` intact from Task 1)
- `schemaFromZod` + `*EffectSchema` exports exist
- `effect` + pinned `zod` in `package.json`
- No `@effect/schema`
- `yarn test:unit` and `yarn tchk` pass

- [ ] **Step 2: Stop for PR if splitting phases**

Phase 0+1 is mergeable on its own.

---

# Phase 2 — Effectify core (tagged errors + Effect decode paths)

### Task 7: Shared tagged errors

**Files:**
- Create: `src/errors.ts`
- Create: `src/errors.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, expect, it } from "vitest";
import { ConfigError, McpClientError, SandboxEvalError, SearchError, WorkspaceError } from "./errors.js";

describe("errors", () => {
  it("exposes _tag discriminants", () => {
    expect(new ConfigError({ message: "x" })._tag).toBe("ConfigError");
    expect(new McpClientError({ server: "s", message: "m" })._tag).toBe("McpClientError");
    expect(new SearchError({ message: "s" })._tag).toBe("SearchError");
    expect(new WorkspaceError({ message: "w" })._tag).toBe("WorkspaceError");
    expect(new SandboxEvalError({ message: "e" })._tag).toBe("SandboxEvalError");
  });
});
```

- [ ] **Step 2: Implement `src/errors.ts`**

```typescript
import { Data } from "effect";

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class McpClientError extends Data.TaggedError("McpClientError")<{
  readonly server: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class SearchError extends Data.TaggedError("SearchError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class WorkspaceError extends Data.TaggedError("WorkspaceError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class SandboxTimeout extends Data.TaggedError("SandboxTimeout")<{
  readonly timeoutMs: number;
}> {}

export class SandboxEvalError extends Data.TaggedError("SandboxEvalError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
```

- [ ] **Step 3: Run + commit**

```bash
yarn vitest run src/errors.test.ts
git add src/errors.ts src/errors.test.ts
git commit -m "$(cat <<'EOF'
feat: add shared Effect tagged error types

EOF
)"
```

---

### Task 8: Port config Zod → native `effect.Schema`

**Files:**
- Modify: `src/config.ts`
- Modify: `src/config.test.ts`

After Task 1, config schemas are Zod. Spec requires **native** `effect.Schema` for config (not Zod + adapter).

- [ ] **Step 1: Red — adjust tests for Effect decode**

Update `config.test.ts` assertions that call `ToolExecutorConfigSchema.parse` / `ServerConfigSchema.parse` to use sync decode helpers you will add (e.g. `parseToolExecutorConfig`). Keep behavioral cases (strict top-level, optional fields, merge fixtures).

- [ ] **Step 2: Replace Zod config schemas with Effect Schema**

In `src/config.ts`, remove `import { z } from "zod"`. Define:

```typescript
import { Effect, Schema } from "effect";
import { ConfigError } from "./errors.js";

const STRICT = { onExcessProperty: "error" as const };

export const ServerConfigSchema = Schema.Struct({
  name: Schema.String.check(Schema.isNonEmpty()),
  displayName: Schema.String.check(Schema.isNonEmpty()),
  command: Schema.String.check(Schema.isNonEmpty()),
  commandEnvKey: Schema.optional(Schema.String),
  trusted: Schema.optional(Schema.Boolean),
  args: Schema.Array(Schema.String),
  env: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});

export const ToolExecutorConfigSchema = Schema.Struct({
  $schema: Schema.optional(Schema.String),
  servers: Schema.Array(ServerConfigSchema),
});

export type ServerConfigFromFile = typeof ServerConfigSchema.Type;
export type ToolExecutorConfig = typeof ToolExecutorConfigSchema.Type;

export const decodeToolExecutorConfig = (
  input: unknown,
): Effect.Effect<ToolExecutorConfig, ConfigError> =>
  Schema.decodeUnknownEffect(ToolExecutorConfigSchema, STRICT)(input).pipe(
    Effect.mapError(
      (error) =>
        new ConfigError({
          message: String(error),
          cause: error,
        }),
    ),
  );

export function parseToolExecutorConfig(input: unknown): ToolExecutorConfig {
  return Schema.decodeUnknownSync(ToolExecutorConfigSchema, STRICT)(input);
}

export function parseServerConfig(input: unknown): ServerConfigFromFile {
  return Schema.decodeUnknownSync(ServerConfigSchema)(input);
}
```

Wire `loadConfig` / `parseLayer` to call `parseToolExecutorConfig` instead of Zod `.parse`. Preserve env-expand + merge behavior.

- [ ] **Step 3: Run config tests**

Run: `yarn vitest run src/config.test.ts`

Expected: PASS with parity to pre-port Zod behavior (nested server strictness may be slightly stricter under Effect — acceptable per prior port notes; document if tests need a one-line update).

- [ ] **Step 4: Commit**

```bash
git add src/config.ts src/config.test.ts
git commit -m "$(cat <<'EOF'
feat(config): port config validation to native effect.Schema

EOF
)"
```

---

### Task 9: Tool handlers return Effect (Promise edge wrapper)

**Files:**
- Modify: `src/tools/search.ts`
- Modify: `src/tools/schema.ts`
- Modify: `src/tools/execute.ts`
- Modify: matching `*.test.ts` as needed
- Modify: `src/index.ts` (thin `runPromise` wrappers)

- [ ] **Step 1: Convert each handler body to `Effect.gen`**

`handleSearchTools` today receives already-typed `SearchToolsInput` from the SDK. Keep that signature for `registerTool` compatibility; add an Effect core that takes `SearchToolsInput` (re-decode only if you intentionally accept `unknown` at the edge).

Replace `src/tools/search.ts` handler section with:

```typescript
import { Effect } from "effect";
import { searchTools } from "../search.js";
import type { SearchToolsInput } from "../schemas.js";
// keep oneLiner / toSearchToolsResponse exports above

export const searchToolsEffect = (
  params: SearchToolsInput,
): Effect.Effect<{
  content: { type: "text"; text: string }[];
  structuredContent: ReturnType<typeof toSearchToolsResponse>;
}> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => searchTools(params.query, params.limit, params.offset),
      catch: (cause) => cause,
    });
    const output = toSearchToolsResponse(params, response);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  });

export async function handleSearchTools(params: SearchToolsInput): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent: ReturnType<typeof toSearchToolsResponse>;
}> {
  return Effect.runPromise(searchToolsEffect(params));
}
```

For `get_tool_schema` and `execute_code`, apply the same pattern: `*Effect` via `Effect.gen` + `Effect.tryPromise` around existing async work; `handle*` remains `async` and `runPromise`s the Effect. Do not change golden response strings. Optional: at the Effect entry of each tool, `yield* Schema.decodeUnknownEffect(*EffectSchema)(params)` for idempotent re-decode (params already typed — cast/`unknown` as needed).

- [ ] **Step 2: Run tool tests**

Run: `yarn vitest run src/tools src/schemas.test.ts`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/tools src/index.ts
git commit -m "$(cat <<'EOF'
refactor(tools): Effect.gen handlers with Promise edge wrappers

EOF
)"
```

---

### Task 10: Phase 2 gate

- [ ] Run `yarn test:unit && yarn tchk`
- [ ] Confirm config Effect decode + tool Effects exist; I/O still mostly Promise underneath
- [ ] Phase 2 mergeable

---

# Phase 3 — Layers + ManagedRuntime + platform-node

### Task 11: Add `@effect/platform-node`

**Files:**
- Modify: `package.json` / `yarn.lock`

- [ ] **Step 1: Add dependency**

Pin `@effect/platform-node` to the Effect 4 beta matching `effect@4.0.0-beta.101` (exact version resolved at install time). Optionally add `@effect/vitest` on the same line if Layer tests will use `it.effect`.

```bash
yarn add @effect/platform-node@4.0.0-beta.101
```

If that version 404s, use the nearest published beta and document the pin in the commit message. Do **not** add `@effect/platform`.

- [ ] **Step 2: Sanity-check**

```bash
node --input-type=module -e 'import { NodeFileSystem } from "@effect/platform-node"; import { FileSystem } from "effect"; console.log(typeof NodeFileSystem.layer, typeof FileSystem.FileSystem);'
```

Expected: layer + Tag present.

- [ ] **Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "$(cat <<'EOF'
chore: add @effect/platform-node for FileSystem layers

EOF
)"
```

---

### Task 12: Domain service Tags + stub Layers

**Files:**
- Create: `src/layers/services.ts`
- Create: `src/layers/AppLive.ts`
- Create: `src/runtime.ts`
- Create: `src/runtime.test.ts`

- [ ] **Step 1: Define Tags**

`src/layers/services.ts`:

```typescript
import { Context, Effect } from "effect";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ConfigLoadResult } from "../config.js";
import type { SearchToolsInput, GetToolSchemaInput, ExecuteCodeInput } from "../schemas.js";
import type { SearchResponse } from "../search.js";
import type { ExecutionResult } from "../types.js"; // adjust if ExecutionResult lives elsewhere

export class AppConfig extends Context.Tag("AppConfig")<
  AppConfig,
  {
    readonly load: () => Effect.Effect<ConfigLoadResult, import("../errors.js").ConfigError>;
  }
>() {}

export class Search extends Context.Tag("Search")<
  Search,
  {
    readonly searchTools: (
      input: SearchToolsInput,
    ) => Effect.Effect<SearchResponse, import("../errors.js").SearchError>;
  }
>() {}

export class ToolSchema extends Context.Tag("ToolSchema")<
  ToolSchema,
  {
    readonly get: (
      input: GetToolSchemaInput,
    ) => Effect.Effect<CallToolResult, never>;
  }
>() {}

export class Sandbox extends Context.Tag("Sandbox")<
  Sandbox,
  {
    readonly execute: (
      input: ExecuteCodeInput,
    ) => Effect.Effect<
      ExecutionResult,
      import("../errors.js").SandboxEvalError | import("../errors.js").SandboxTimeout
    >;
  }
>() {}
```

Adjust `ExecutionResult` import to the real module (`sandbox/runtime.ts` types).

- [ ] **Step 2: `ManagedRuntime` factory**

`src/runtime.ts`:

```typescript
import { Layer, ManagedRuntime } from "effect";
import { NodeFileSystem } from "@effect/platform-node";
import { AppLive } from "./layers/AppLive.js";

export type AppRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<typeof AppLive>,
  Layer.Layer.Error<typeof AppLive>
>;

export function makeAppRuntime(): AppRuntime {
  return ManagedRuntime.make(AppLive);
}
```

- [ ] **Step 3: Minimal `AppLive`**

Start with `Layer.mergeAll(NodeFileSystem.layer, /* domain layers */)` composing succeed/effect layers that wrap current Promise APIs via `Effect.tryPromise` — behavior-preserving.

- [ ] **Step 4: Test runtime make/dispose**

```typescript
import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { makeAppRuntime } from "./runtime.js";

describe("runtime", () => {
  it("builds and disposes", async () => {
    const runtime = makeAppRuntime();
    await runtime.runPromise(Effect.void);
    await runtime.dispose();
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 5: Commit**

```bash
git add src/layers src/runtime.ts src/runtime.test.ts
git commit -m "$(cat <<'EOF'
feat: add AppLive Tags and ManagedRuntime factory

EOF
)"
```

---

### Task 13: Move MCP clients + workspace behind Layers

**Files:**
- Modify: `src/sandbox/clients.ts`
- Modify: `src/sandbox/workspace.ts`
- Modify: `src/layers/*`
- Tests under `src/sandbox/*.test.ts`

- [ ] Wrap connection pool + workspace FS ops as service methods returning `Effect`.
- [ ] Preserve idle cleanup / signal shutdown by registering finalizers in the Layer scope (`Effect.acquireRelease` / Layer unwrap).
- [ ] Keep path-traversal error messages identical (`WorkspaceError` with same `message` strings tests assert).
- [ ] Run: `yarn vitest run src/sandbox`
- [ ] Commit: `refactor(sandbox): expose clients and workspace as Effect Layers`

---

### Task 14: Sandbox execute via Layer + `tryPromise` eval

**Files:**
- Modify: `src/sandbox/runtime.ts`
- Modify: `src/tools/execute.ts`

- [ ] `Sandbox.execute` Effect acquires clients/workspace from Tags.
- [ ] Only the `AsyncFunction` construction/invocation uses `Effect.tryPromise`.
- [ ] Timeout → `SandboxTimeout` tagged error; map to existing timeout message at MCP edge.
- [ ] Run sandbox + execute tests; commit.

---

### Task 15: Wire tool Effects to `ManagedRuntime`

**Files:**
- Modify: `src/index.ts`
- Modify: `src/tools/*`

- [ ] Create one process runtime in module scope (or lazy singleton):

```typescript
const appRuntime = makeAppRuntime();

server.registerTool("search_tools", { /* ... */ }, (args) =>
  appRuntime.runPromise(searchToolsEffect(args)),
);
```

- [ ] On stdin close / signals: `await appRuntime.dispose()` then exit (Phase 4 polishes this).
- [ ] Run `yarn test:unit`; commit.

---

### Task 16: Phase 3 gate

- [ ] `yarn test:unit && yarn tchk`
- [ ] Confirm no `@effect/schema`; platform-node present; `ManagedRuntime` owns services

---

# Phase 4 — CLI / main Layer launch

### Task 17: CLI actions as Effects

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/cli.test.ts`

- [ ] Convert command actions to `Effect` programs provided by CLI-scoped or shared `AppLive`.
- [ ] `Effect.runPromise` only inside `.action(async () => { ... })` callbacks.
- [ ] Preserve CLI output strings.
- [ ] Run `yarn vitest run src/cli.test.ts`; commit.

---

### Task 18: Main lifecycle dispose

**Files:**
- Modify: `src/index.ts`
- Modify: `src/index.test.ts`

- [ ] `main` builds runtime, connects transport, registers dispose on stdin close + process signals.
- [ ] Ensure double-dispose is safe.
- [ ] Run full `yarn test:unit && yarn tchk && yarn lint`
- [ ] Commit: `feat: ManagedRuntime lifecycle for MCP server process`

---

### Task 19: Final success criteria checklist

- [ ] Zod `registerTool` for all three tools
- [ ] No custom Effect MCP registrar
- [ ] Tool programs decode via adapted `effect.Schema`
- [ ] Config native `effect.Schema` + Effect load (platform FS)
- [ ] `AppLive` + `ManagedRuntime`
- [ ] Sandbox eval only impurity behind `tryPromise`
- [ ] No `@effect/schema`
- [ ] Unit/lint/typecheck green

---

## Spec coverage (self-review)

| Spec requirement | Tasks |
| --- | --- |
| Revert declined port; start from Zod baseline | 1 |
| Pin zod + add effect | 2 |
| `schemaFromZod` full pipeline | 3, 4 |
| Zod SoT + `registerTool` (via revert) + Effect schema exports | 1, 5, 6 |
| Config native Effect Schema (from Zod baseline) | 8, then 13 (FS) |
| Layers + ManagedRuntime | 11–15 |
| Sandbox tryPromise eval | 14 |
| Tagged errors | 7, 9, 13–14 |
| Phased delivery | Phase gates 6, 10, 16, 19 |
| No `@effect/schema` | Notes + gates |
| CLI/main launch | 17–18 |
| Testing / parity | Embedded in each task |

**Design note absorbed:** Effect 4 ships `FileSystem`/`Path` in `effect`; plan installs `@effect/platform-node` only (not `@effect/platform`).

**Execution note:** Prefer landing Task 1 (revert) + Phase 1 as the first PR before Layers work.