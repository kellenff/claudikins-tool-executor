# Effect FP + Zod MCP Adapter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use snowball:subagent-driven-development (recommended) or snowball:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Zod as the MCP tool-input SoT with `registerTool`, add a Zod → `effect.Schema` adapter, keep config on native `effect.Schema`, and migrate the app to Effect programs + Layers + `ManagedRuntime` in four mergeable phases.

**Architecture:** Zod schemas feed `McpServer.registerTool`. `schemaFromZod` wraps each Zod schema so Effect decode runs the full Zod pipeline. Config stays Effect Schema. Process I/O lives in `AppLive` behind `ManagedRuntime`; handlers call `runtime.runPromise`. Sandbox eval stays `Effect.tryPromise(AsyncFunction)`.

**Tech Stack:** TypeScript ESM, Vitest, `effect@4.0.0-beta.101`, `zod@4.4.3` (pinned, no `^`), `@effect/platform-node` (pinned to Effect 4 beta line; FileSystem/Path live in `effect` itself — do **not** add legacy `@effect/platform` or `@effect/schema`).

**Spec:** `docs/snowball/specs/2026-07-24-effect-fp-zod-adapter-design.md`

## File Structure

| File | Action | Phase | Responsibility |
| --- | --- | --- | --- |
| `package.json` / `yarn.lock` | Modify | 1, 3 | Re-add `zod`; later add `@effect/platform-node` (+ `@effect/vitest` if used) |
| `src/zod-effect.ts` | Create | 1 | `schemaFromZod` adapter |
| `src/zod-effect.test.ts` | Create | 1 | Adapter decode/idempotency/refine tests |
| `src/schemas.ts` | Modify | 1 | Zod SoT + adapted Effect schemas + `parse*` via adapter |
| `src/schemas.test.ts` | Modify | 1 | Zod `.shape` descriptions + `parse*` / adapter decode |
| `src/index.ts` | Modify | 1, 4 | Restore `registerTool`; later runtime lifecycle |
| `src/index.test.ts` | Modify | 1, 4 | Mock `registerTool` instead of `registerEffectTools` |
| `src/register-tools.ts` | Delete | 1 | Declined custom registrar |
| `src/register-tools.test.ts` | Delete | 1 | Goes with registrar |
| `src/errors.ts` | Create | 2 | Shared `Data.TaggedError` types |
| `src/config.ts` | Modify | 2, 3 | Effect decode helpers; later platform FS load |
| `src/tools/*.ts` | Modify | 2–3 | Effect handlers |
| `src/search.ts` | Modify | 2–3 | Effect search behind Tag |
| `src/sandbox/*.ts` | Modify | 3 | Layers + tryPromise eval |
| `src/layers/*.ts` | Create | 3 | Domain Tags + `AppLive` |
| `src/runtime.ts` | Create | 3 | `ManagedRuntime` factory |
| `src/cli.ts` | Modify | 4 | Effect CLI actions |

## Implementation Notes (read first)

1. **Baseline:** This branch may still contain the declined Effect-Schema-SoT port. Phase 1 intentionally restores Zod + `registerTool` and deletes `register-tools.ts`.
2. **Pins:** No `^` on new deps. Prefer `zod: "4.4.3"` (matches current lockfile transitive). Keep `effect: "4.0.0-beta.101"`. Pin `@effect/platform-node` to the same beta line (probe npm for `4.0.0-beta.101` or nearest published; vendored tree shows `4.0.0-beta.100`).
3. **Effect 4 platform:** `FileSystem` / `Path` import from `"effect"`. Node live layer from `@effect/platform-node` (`NodeFileSystem.layer`). There is **no** separate `@effect/platform` package on this Effect line.
4. **Adapter:** Prefer community Effect4+Zod4 → `effect.Schema` bridge if found and peer-compatible; otherwise use in-repo `Schema.declareConstructor` that calls `zod.safeParse` (full pipeline). Never pass adapted schemas to `registerTool`.
5. **Double decode:** SDK validates with Zod; Effect entry re-decodes via adapter. Schemas must be idempotent (defaults/strictness).
6. **Do not add** `@effect/schema`.
7. **Lint:** `yarn fix` on touched files before commit; explicit return types; `.js` import extensions.

---

# Phase 1 — MCP edge restore + adapter

### Task 1: Re-add pinned `zod`

**Files:**
- Modify: `package.json`
- Modify: `yarn.lock` (via yarn)

- [ ] **Step 1: Edit `package.json` dependencies**

Add under `dependencies` (keep `"effect": "4.0.0-beta.101"`):

```json
"zod": "4.4.3"
```

Do not use `^`. Do not remove `effect`.

- [ ] **Step 2: Install**

Run: `yarn install`

Expected: lockfile updates; `zod@4.4.3` resolvable from this package.

- [ ] **Step 3: Sanity-check import**

Run:

```bash
node --input-type=module -e 'import { z } from "zod"; console.log(typeof z.object, z.version ?? "ok");'
```

Expected: `function` and a version/ok print; exit 0.

- [ ] **Step 4: Commit**

```bash
git add package.json yarn.lock
git commit -m "$(cat <<'EOF'
chore: re-add pinned zod for MCP registerTool

EOF
)"
```

---

### Task 2: Red — adapter tests

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

### Task 3: Green — implement `schemaFromZod`

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

### Task 4: Restore Zod tool schemas

**Files:**
- Modify: `src/schemas.ts`
- Modify: `src/schemas.test.ts`

- [ ] **Step 1: Rewrite `src/schemas.ts`**

Replace file contents with:

```typescript
import { z } from "zod";

import {
  EXECUTE_CODE_DEFAULT_TIMEOUT_MS,
  EXECUTE_CODE_MAX_TIMEOUT_MS,
  EXECUTE_CODE_MIN_TIMEOUT_MS,
  SEARCH_TOOLS_DEFAULT_LIMIT,
  SEARCH_TOOLS_MAX_LIMIT,
} from "./constants.js";
import { decodeZodSync, schemaFromZod } from "./zod-effect.js";

/** Input schema for search_tools (Zod SoT for MCP registerTool) */
export const SearchToolsInputSchema = z
  .object({
    query: z
      .string()
      .min(1, "Query cannot be empty")
      .describe("Search query for finding relevant tools"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(SEARCH_TOOLS_MAX_LIMIT)
      .default(SEARCH_TOOLS_DEFAULT_LIMIT)
      .describe(`Maximum results to return (default: ${SEARCH_TOOLS_DEFAULT_LIMIT})`),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Number of results to skip for pagination (default: 0)"),
  })
  .strict();

export type SearchToolsInput = z.infer<typeof SearchToolsInputSchema>;

export const SearchToolsEffectSchema = schemaFromZod(SearchToolsInputSchema);

export function parseSearchToolsInput(input: unknown): SearchToolsInput {
  return decodeZodSync(SearchToolsInputSchema, input);
}

/** Input schema for get_tool_schema */
export const GetToolSchemaInputSchema = z
  .object({
    name: z
      .string()
      .min(1, "Tool name cannot be empty")
      .describe("Tool name (from search_tools results)"),
  })
  .strict();

export type GetToolSchemaInput = z.infer<typeof GetToolSchemaInputSchema>;

export const GetToolSchemaEffectSchema = schemaFromZod(GetToolSchemaInputSchema);

export function parseGetToolSchemaInput(input: unknown): GetToolSchemaInput {
  return decodeZodSync(GetToolSchemaInputSchema, input);
}

/** Input schema for execute_code */
export const ExecuteCodeInputSchema = z
  .object({
    code: z
      .string()
      .min(1, "Code cannot be empty")
      .describe("TypeScript/JavaScript code to execute"),
    timeout: z
      .number()
      .int()
      .min(EXECUTE_CODE_MIN_TIMEOUT_MS)
      .max(EXECUTE_CODE_MAX_TIMEOUT_MS)
      .default(EXECUTE_CODE_DEFAULT_TIMEOUT_MS)
      .describe(`Execution timeout in ms (default: ${EXECUTE_CODE_DEFAULT_TIMEOUT_MS})`),
  })
  .strict();

export type ExecuteCodeInput = z.infer<typeof ExecuteCodeInputSchema>;

export const ExecuteCodeEffectSchema = schemaFromZod(ExecuteCodeInputSchema);

export function parseExecuteCodeInput(input: unknown): ExecuteCodeInput {
  return decodeZodSync(ExecuteCodeInputSchema, input);
}
```

- [ ] **Step 2: Restore Zod-oriented `src/schemas.test.ts`**

Replace with:

```typescript
import { describe, expect, it } from "vitest";
import { Effect, Schema } from "effect";

import {
  ExecuteCodeEffectSchema,
  ExecuteCodeInputSchema,
  GetToolSchemaEffectSchema,
  GetToolSchemaInputSchema,
  parseExecuteCodeInput,
  parseGetToolSchemaInput,
  parseSearchToolsInput,
  SearchToolsEffectSchema,
  SearchToolsInputSchema,
} from "./schemas.js";

describe("schemas", () => {
  it("applies defaults for search tools input", () => {
    const parsed = parseSearchToolsInput({ query: "diagram" });
    expect(parsed).toMatchObject({
      query: "diagram",
      limit: 5,
      offset: 0,
    });
  });

  it("validates search tools input", () => {
    expect(() => parseSearchToolsInput({ query: "" })).toThrow();
    expect(() => parseSearchToolsInput({ query: "ok", limit: 0 })).toThrow();
    expect(() => parseSearchToolsInput({ query: "ok", limit: 51 })).toThrow();
    expect(() => parseSearchToolsInput({ query: "ok", limit: 1.5 })).toThrow();
    expect(() => parseSearchToolsInput({ query: "ok", offset: -1 })).toThrow();
    expect(() => parseSearchToolsInput({ query: "ok", extra: true })).toThrow();
    expect(parseSearchToolsInput({ query: "ok", limit: 50, offset: 2 })).toEqual({
      query: "ok",
      limit: 50,
      offset: 2,
    });
    expect(SearchToolsInputSchema.shape.query.description).toBe(
      "Search query for finding relevant tools",
    );
    expect(SearchToolsInputSchema.shape.limit.description).toBe(
      "Maximum results to return (default: 5)",
    );
    expect(SearchToolsInputSchema.shape.offset.description).toBe(
      "Number of results to skip for pagination (default: 0)",
    );
  });

  it("validates get tool schema input", () => {
    expect(() => parseGetToolSchemaInput({ name: "" })).toThrow();
    expect(() => parseGetToolSchemaInput({ name: "ok" })).not.toThrow();
    expect(() => parseGetToolSchemaInput({ name: "ok", extra: true })).toThrow();
    expect(GetToolSchemaInputSchema.shape.name.description).toBe(
      "Tool name (from search_tools results)",
    );
  });

  it("applies defaults and validates execute input", () => {
    const parsed = parseExecuteCodeInput({ code: "1 + 1" });
    expect(parsed.timeout).toBe(30000);
    expect(() => parseExecuteCodeInput({ code: "" })).toThrow();
    expect(() => parseExecuteCodeInput({ code: "1+1", timeout: 10 })).toThrow();
    expect(() => parseExecuteCodeInput({ code: "1+1", timeout: 600001 })).toThrow();
    expect(() => parseExecuteCodeInput({ code: "1+1", timeout: 1000.5 })).toThrow();
    expect(() => parseExecuteCodeInput({ code: "1+1", timeout: 1000, extra: true })).toThrow();
    expect(parseExecuteCodeInput({ code: "1+1", timeout: 1000 })).toEqual({
      code: "1+1",
      timeout: 1000,
    });
    expect(ExecuteCodeInputSchema.shape.code.description).toBe(
      "TypeScript/JavaScript code to execute",
    );
    expect(ExecuteCodeInputSchema.shape.timeout.description).toBe(
      "Execution timeout in ms (default: 30000)",
    );
  });

  it("adapted Effect schemas match parse helpers", async () => {
    const search = await Effect.runPromise(
      Schema.decodeUnknownEffect(SearchToolsEffectSchema)({ query: "x" }),
    );
    expect(search).toEqual(parseSearchToolsInput({ query: "x" }));

    const tool = await Effect.runPromise(
      Schema.decodeUnknownEffect(GetToolSchemaEffectSchema)({ name: "t" }),
    );
    expect(tool).toEqual(parseGetToolSchemaInput({ name: "t" }));

    const exec = await Effect.runPromise(
      Schema.decodeUnknownEffect(ExecuteCodeEffectSchema)({ code: "1" }),
    );
    expect(exec).toEqual(parseExecuteCodeInput({ code: "1" }));
  });
});
```

- [ ] **Step 3: Run schema tests**

Run: `yarn vitest run src/schemas.test.ts src/zod-effect.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/schemas.ts src/schemas.test.ts
git commit -m "$(cat <<'EOF'
feat(schemas): restore Zod SoT and export Effect adapters

EOF
)"
```

---

### Task 5: Restore `registerTool`; delete custom registrar

**Files:**
- Modify: `src/index.ts`
- Modify: `src/index.test.ts`
- Delete: `src/register-tools.ts`
- Delete: `src/register-tools.test.ts`

- [ ] **Step 1: Update `src/index.test.ts` mocks**

Replace the schemas + register-tools mocks and assertions to expect `registerTool` on `McpServer`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

const registerTool = vi.fn();
const mcpServerConstructor = vi.fn();
const startLifecycleManagement = vi.fn();
const getAvailableClientNames = vi.fn().mockReturnValue(["serena", "gemini"]);
const getSandboxClientBindings = vi.fn().mockReturnValue(["serena", "gemini"]);
const connect = vi.fn().mockResolvedValue(undefined);
const dotenvConfig = vi.fn();
const stdioConstructor = vi.fn();

vi.mock("dotenv", () => ({
  default: {
    config: dotenvConfig,
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class {
    registerTool = registerTool;
    connect = connect;

    constructor(options: unknown) {
      mcpServerConstructor(options);
    }
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", async () => {
  const actual = await vi.importActual("@modelcontextprotocol/sdk/server/stdio.js");
  return {
    ...(actual as Record<string, unknown>),
    StdioServerTransport: class {
      type = "stdio-transport";
      constructor() {
        stdioConstructor();
      }
    },
  };
});

vi.mock("./schemas.js", () => ({
  SearchToolsInputSchema: { _zod: "search" },
  GetToolSchemaInputSchema: { _zod: "schema" },
  ExecuteCodeInputSchema: { _zod: "execute" },
}));

vi.mock("./tools/index.js", () => ({
  handleSearchTools: vi.fn(),
  handleGetToolSchema: vi.fn(),
  handleExecuteCode: vi.fn(),
}));

vi.mock("./sandbox/clients.js", () => ({
  startLifecycleManagement,
}));

vi.mock("./sandbox/runtime.js", () => ({
  getAvailableClientNames,
  getSandboxClientBindings,
}));

describe("index", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    registerTool.mockReset();
    mcpServerConstructor.mockReset();
    startLifecycleManagement.mockReset();
    getAvailableClientNames.mockReset().mockReturnValue(["serena", "gemini"]);
    getSandboxClientBindings.mockReset().mockReturnValue(["serena", "gemini"]);
    connect.mockReset().mockResolvedValue(undefined);
    dotenvConfig.mockReset();
    stdioConstructor.mockReset();
  });

  it("registers three tools with Zod inputSchema via registerTool", async () => {
    await import("./index.js");
    expect(registerTool).toHaveBeenCalledTimes(3);
    const names = registerTool.mock.calls.map((call) => call[0]);
    expect(names).toEqual(["search_tools", "get_tool_schema", "execute_code"]);
    for (const call of registerTool.mock.calls) {
      expect(call[1].inputSchema).toBeTruthy();
    }
  });
});
```

Keep/adapt any remaining existing cases for `main`/lifecycle if present in the file after this change — do not drop coverage for `startLifecycleManagement` / `connect` if those tests already exist; update them to the `registerTool` mock style instead of deleting.

- [ ] **Step 2: Rewrite `src/index.ts` tool registration**

Remove `registerEffectTools` / `parse*` imports used only for the custom registrar. Restore three `server.registerTool(...)` calls with Zod schemas and existing handlers (same descriptions/annotations as current `registerEffectTools` table). Pattern:

```typescript
server.registerTool(
  "search_tools",
  {
    title: "Search MCP Tools",
    description: `...`, // keep existing description text verbatim
    inputSchema: SearchToolsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  handleSearchTools,
);
```

Repeat for `get_tool_schema` and `execute_code` (keep dynamic `clientList` in execute description).

Leave `main()` lifecycle as-is for Phase 1.

- [ ] **Step 3: Delete registrar files**

```bash
rm src/register-tools.ts src/register-tools.test.ts
```

Grep for `register-tools` / `registerEffectTools` under `src/` and fix any stragglers.

- [ ] **Step 4: Run unit tests for touched surface**

Run:

```bash
yarn vitest run src/schemas.test.ts src/zod-effect.test.ts src/index.test.ts
yarn tchk
```

Expected: PASS.

- [ ] **Step 5: Full unit gate**

Run: `yarn test:unit`

Expected: PASS (fix any fallout from deleted registrar helpers).

- [ ] **Step 6: Commit**

```bash
git add -A src/index.ts src/index.test.ts src/register-tools.ts src/register-tools.test.ts
git commit -m "$(cat <<'EOF'
feat(mcp): restore Zod registerTool; remove Effect registrar

EOF
)"
```

---

### Task 6: Phase 1 gate

- [ ] **Step 1: Verify success criteria for Phase 1**

- Three tools use Zod via `registerTool`
- `schemaFromZod` + `*EffectSchema` exports exist
- No `register-tools.ts`
- No `@effect/schema`
- `yarn test:unit` and `yarn tchk` pass

- [ ] **Step 2: Commit any leftover fixups, then stop for PR if splitting phases**

Phase 1 is mergeable on its own.

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

### Task 8: Config decode as Effect (keep sync FS for now)

**Files:**
- Modify: `src/config.ts`
- Modify: `src/config.test.ts`

- [ ] **Step 1: Add Effect decode helpers alongside existing sync parsers**

In `src/config.ts`, keep `ServerConfigSchema` / `ToolExecutorConfigSchema` as native Effect Schema. Add:

```typescript
import { Effect, Schema } from "effect";
import { ConfigError } from "./errors.js";

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
    Effect.map((value) => value as ToolExecutorConfig),
  );
```

Keep `parseToolExecutorConfig` as:

```typescript
export function parseToolExecutorConfig(input: unknown): ToolExecutorConfig {
  return Effect.runSync(decodeToolExecutorConfig(input));
}
```

(Or `decodeUnknownSync` if `runSync` on Schema errors is awkward — preserve throw behavior for existing tests.)

- [ ] **Step 2: Ensure `config.test.ts` still passes**

Run: `yarn vitest run src/config.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/config.ts src/config.test.ts
git commit -m "$(cat <<'EOF'
refactor(config): expose Effect decode path for ToolExecutorConfig

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
| Zod SoT + `registerTool` | 1, 4, 5 |
| `schemaFromZod` full pipeline | 2, 3 |
| Config native Effect Schema | 8 (exists), 13 (FS) |
| Layers + ManagedRuntime | 11–15 |
| Sandbox tryPromise eval | 14 |
| Tagged errors | 7, 9, 13–14 |
| Phased delivery | Phase gates 6, 10, 16, 19 |
| No `@effect/schema` | Notes + gates |
| CLI/main launch | 17–18 |
| Testing / parity | Embedded in each task |

**Design note absorbed:** Effect 4 ships `FileSystem`/`Path` in `effect`; plan installs `@effect/platform-node` only (not `@effect/platform`).
