# Zod → Effect Schema Port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use snowball:subagent-driven-development (recommended) or snowball:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all application Zod usage with Effect `Schema` (from `"effect"`, not `@effect/schema`), remove `zod` from our `package.json`, and advertise/validate MCP tools via JSON Schema + `decodeUnknownSync` without `McpServer.registerTool`.

**Architecture:** Effect schemas are the single source of truth in `src/schemas.ts` and `src/config.ts`. Sync throwing decode helpers mirror Zod `.parse()`. A new `src/register-tools.ts` installs `tools/list` / `tools/call` on `mcpServer.server` using `Schema.toJsonSchemaDocument` for listing and Effect decode for calls. `src/index.ts` only constructs `McpServer` and calls the registrar.

**Tech Stack:** TypeScript ESM, Vitest, `effect@4.0.0-beta.101` (pinned; Schema v4 API), `@modelcontextprotocol/sdk` (Zod remains transitive/optional for protocol framing only).

**Spec:** `docs/snowball/specs/2026-07-23-zod-to-effect-schema-design.md`

## File Structure

| File | Action | Responsibility |
| --- | --- | --- |
| `package.json` / `yarn.lock` | Modify | Add pinned `effect`; remove direct `zod` |
| `src/schemas.ts` | Modify | Effect tool input schemas + `parse*` helpers |
| `src/schemas.test.ts` | Modify | Assert via `parse*` + JSON Schema descriptions |
| `src/config.ts` | Modify | Effect config schemas; `parseLayer` uses decode helper |
| `src/config.test.ts` | Modify | Replace `.parse()` with `parse*` helpers |
| `src/register-tools.ts` | Create | List/call wiring + pure list/call helpers for tests |
| `src/register-tools.test.ts` | Create | JSON Schema smoke + validation error path |
| `src/index.ts` | Modify | Drop `registerTool`; call `registerEffectTools` |

## Implementation Notes (read first)

1. **Effect pin:** Use `"effect": "4.0.0-beta.101"` (no `^`). Do **not** add `@effect/schema`. Do **not** use Effect 3.x (`3.22` still latest stable on npm — wrong API for this port).
2. **Strictness:** Tool inputs and `ToolExecutorConfig` decode with `{ onExcessProperty: "error" }`. `ServerConfig` uses default `"ignore"` (strip extras). Nested server objects under a strict parent decode will also reject extras (slightly stricter than Zod); acceptable.
3. **Defaults:** Use `Schema.withDecodingDefault(Effect.succeed(...))` so missing/`undefined` keys get defaults like Zod `.default()`.
4. **Never call `registerTool`:** It requires Zod and will throw on JSON Schema. Set handlers on `mcp.server` only.
5. **Imports:** `import { Effect, Schema } from "effect"`; MCP types from `@modelcontextprotocol/sdk/types.js`; `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`.

---

### Task 1: Add `effect`, remove direct `zod`

**Files:**
- Modify: `package.json`
- Modify: `yarn.lock` (via yarn)

- [ ] **Step 1: Edit dependencies in `package.json`**

In `dependencies`, remove the `"zod": "^4.3.5"` entry and add:

```json
"effect": "4.0.0-beta.101"
```

Keep all other dependency versions unchanged.

- [ ] **Step 2: Install**

Run: `yarn install`

Expected: lockfile updates; `effect` present; our package no longer lists `zod` as a direct dependency.

- [ ] **Step 3: Sanity-check the Schema API**

Run:

```bash
node --input-type=module -e 'import { Schema } from "effect"; console.log(typeof Schema.decodeUnknownSync, typeof Schema.toJsonSchemaDocument, typeof Schema.Struct);'
```

Expected: prints `function function function`.

- [ ] **Step 4: Commit**

```bash
git add package.json yarn.lock
git commit -m "$(cat <<'EOF'
chore: add effect Schema; drop direct zod dependency

EOF
)"
```

---

### Task 2: Red — rewrite `schemas.test.ts` for parse helpers

**Files:**
- Modify: `src/schemas.test.ts`

- [ ] **Step 1: Replace the test file contents**

Overwrite `src/schemas.test.ts` with:

```typescript
import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import {
  ExecuteCodeInputSchema,
  GetToolSchemaInputSchema,
  SearchToolsInputSchema,
  parseExecuteCodeInput,
  parseGetToolSchemaInput,
  parseSearchToolsInput,
} from "./schemas.js";

function fieldDescription(
  schema: Parameters<typeof Schema.toJsonSchemaDocument>[0],
  field: string,
): string | undefined {
  const doc = Schema.toJsonSchemaDocument(schema);
  const properties = doc.schema.properties as
    | Record<string, { description?: string }>
    | undefined;
  return properties?.[field]?.description;
}

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
    expect(fieldDescription(SearchToolsInputSchema, "query")).toBe(
      "Search query for finding relevant tools",
    );
    expect(fieldDescription(SearchToolsInputSchema, "limit")).toBe(
      "Maximum results to return (default: 5)",
    );
    expect(fieldDescription(SearchToolsInputSchema, "offset")).toBe(
      "Number of results to skip for pagination (default: 0)",
    );
  });

  it("validates get tool schema input", () => {
    expect(() => parseGetToolSchemaInput({ name: "" })).toThrow();
    expect(() => parseGetToolSchemaInput({ name: "ok" })).not.toThrow();
    expect(() => parseGetToolSchemaInput({ name: "ok", extra: true })).toThrow();
    expect(fieldDescription(GetToolSchemaInputSchema, "name")).toBe(
      "Tool name (from search_tools results)",
    );
  });

  it("applies defaults and validates execute input", () => {
    const parsed = parseExecuteCodeInput({ code: "1 + 1" });
    expect(parsed.timeout).toBe(30000);
    expect(() => parseExecuteCodeInput({ code: "" })).toThrow();
    expect(() => parseExecuteCodeInput({ code: "1+1", timeout: 10 })).toThrow();
    expect(() =>
      parseExecuteCodeInput({ code: "1+1", timeout: 600001 }),
    ).toThrow();
    expect(() =>
      parseExecuteCodeInput({ code: "1+1", timeout: 1000.5 }),
    ).toThrow();
    expect(() =>
      parseExecuteCodeInput({ code: "1+1", timeout: 1000, extra: true }),
    ).toThrow();
    expect(parseExecuteCodeInput({ code: "1+1", timeout: 1000 })).toEqual({
      code: "1+1",
      timeout: 1000,
    });
    expect(fieldDescription(ExecuteCodeInputSchema, "code")).toBe(
      "TypeScript/JavaScript code to execute",
    );
    expect(fieldDescription(ExecuteCodeInputSchema, "timeout")).toBe(
      "Execution timeout in ms (default: 30000)",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/schemas.test.ts`

Expected: FAIL (missing exports / still Zod `.parse` API).

- [ ] **Step 3: Commit the red tests**

```bash
git add src/schemas.test.ts
git commit -m "$(cat <<'EOF'
test(schemas): switch assertions to Effect parse helpers

EOF
)"
```

---

### Task 3: Green — rewrite `src/schemas.ts` with Effect Schema

**Files:**
- Modify: `src/schemas.ts`

- [ ] **Step 1: Replace `src/schemas.ts` with Effect schemas**

```typescript
import { Effect, Schema } from "effect";

import {
  EXECUTE_CODE_DEFAULT_TIMEOUT_MS,
  EXECUTE_CODE_MAX_TIMEOUT_MS,
  EXECUTE_CODE_MIN_TIMEOUT_MS,
  SEARCH_TOOLS_DEFAULT_LIMIT,
  SEARCH_TOOLS_MAX_LIMIT,
} from "./constants.js";

const STRICT = { onExcessProperty: "error" as const };

/** Input schema for search_tools */
export const SearchToolsInputSchema = Schema.Struct({
  query: Schema.String.check(
    Schema.isNonEmpty({ message: "Query cannot be empty" }),
  ).annotate({
    description: "Search query for finding relevant tools",
  }),
  limit: Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({
      minimum: 1,
      maximum: SEARCH_TOOLS_MAX_LIMIT,
    }),
  )
    .annotate({
      description: `Maximum results to return (default: ${SEARCH_TOOLS_DEFAULT_LIMIT})`,
    })
    .pipe(Schema.withDecodingDefault(Effect.succeed(SEARCH_TOOLS_DEFAULT_LIMIT))),
  offset: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
  )
    .annotate({
      description: "Number of results to skip for pagination (default: 0)",
    })
    .pipe(Schema.withDecodingDefault(Effect.succeed(0))),
});

export type SearchToolsInput = typeof SearchToolsInputSchema.Type;

export function parseSearchToolsInput(input: unknown): SearchToolsInput {
  return Schema.decodeUnknownSync(SearchToolsInputSchema, STRICT)(input);
}

/** Input schema for get_tool_schema */
export const GetToolSchemaInputSchema = Schema.Struct({
  name: Schema.String.check(
    Schema.isNonEmpty({ message: "Tool name cannot be empty" }),
  ).annotate({
    description: "Tool name (from search_tools results)",
  }),
});

export type GetToolSchemaInput = typeof GetToolSchemaInputSchema.Type;

export function parseGetToolSchemaInput(input: unknown): GetToolSchemaInput {
  return Schema.decodeUnknownSync(GetToolSchemaInputSchema, STRICT)(input);
}

/** Input schema for execute_code */
export const ExecuteCodeInputSchema = Schema.Struct({
  code: Schema.String.check(
    Schema.isNonEmpty({ message: "Code cannot be empty" }),
  ).annotate({
    description: "TypeScript/JavaScript code to execute",
  }),
  timeout: Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({
      minimum: EXECUTE_CODE_MIN_TIMEOUT_MS,
      maximum: EXECUTE_CODE_MAX_TIMEOUT_MS,
    }),
  )
    .annotate({
      description: `Execution timeout in ms (default: ${EXECUTE_CODE_DEFAULT_TIMEOUT_MS})`,
    })
    .pipe(
      Schema.withDecodingDefault(Effect.succeed(EXECUTE_CODE_DEFAULT_TIMEOUT_MS)),
    ),
});

export type ExecuteCodeInput = typeof ExecuteCodeInputSchema.Type;

export function parseExecuteCodeInput(input: unknown): ExecuteCodeInput {
  return Schema.decodeUnknownSync(ExecuteCodeInputSchema, STRICT)(input);
}
```

If `typeof X.Type` fails typechecking, switch exported types to `Schema.Schema.Type<typeof SearchToolsInputSchema>` (and likewise for the others). Prefer whichever compiles under the installed Effect build.

- [ ] **Step 2: Run schemas tests**

Run: `yarn vitest run src/schemas.test.ts`

Expected: PASS. If description assertions fail because JSON Schema nests differently, adjust `fieldDescription` only (do not weaken validation tests).

- [ ] **Step 3: Commit**

```bash
git add src/schemas.ts src/schemas.test.ts
git commit -m "$(cat <<'EOF'
feat(schemas): port tool input validation to Effect Schema

EOF
)"
```

---

### Task 4: Red — point config tests at parse helpers

**Files:**
- Modify: `src/config.test.ts`

- [ ] **Step 1: Update imports and schema call sites**

1. Change the import from `./config.js` to also pull:

```typescript
import {
  // existing imports stay
  parseServerConfig,
  parseToolExecutorConfig,
  ServerConfigSchema,
  ToolExecutorConfigSchema,
} from "./config.js";
```

Keep `ServerConfigSchema` / `ToolExecutorConfigSchema` imports only if still needed; otherwise drop them.

2. Replace every `ServerConfigSchema.parse(` with `parseServerConfig(` and every `ToolExecutorConfigSchema.parse(` with `parseToolExecutorConfig(` in this file (merge helpers + schema describe block near the end).

Do not change merge/load behavior tests beyond the parse helper rename.

- [ ] **Step 2: Run the schema-focused config tests (expect fail)**

Run: `yarn vitest run src/config.test.ts -t "ServerConfigSchema|ToolExecutorConfigSchema|mergeLoadedLayers"`

Expected: FAIL on missing `parseServerConfig` / `parseToolExecutorConfig`.

- [ ] **Step 3: Commit red test edits**

```bash
git add src/config.test.ts
git commit -m "$(cat <<'EOF'
test(config): use Effect parse helpers instead of Zod parse

EOF
)"
```

---

### Task 5: Green — port `src/config.ts` schemas

**Files:**
- Modify: `src/config.ts`

- [ ] **Step 1: Replace Zod schemas and wire parse helpers**

At the top of `src/config.ts`, remove `import { z } from "zod"` and add:

```typescript
import { Schema } from "effect";
```

Replace the schema block (through the type aliases) with:

```typescript
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

export type ToolExecutorConfig = typeof ToolExecutorConfigSchema.Type;
export type ServerConfigFromFile = typeof ServerConfigSchema.Type;

export function parseServerConfig(input: unknown): ServerConfigFromFile {
  return Schema.decodeUnknownSync(ServerConfigSchema)(input);
}

export function parseToolExecutorConfig(input: unknown): ToolExecutorConfig {
  return Schema.decodeUnknownSync(ToolExecutorConfigSchema, STRICT)(input);
}
```

In `parseLayer`, replace:

```typescript
const validated = ToolExecutorConfigSchema.parse(expanded);
```

with:

```typescript
const validated = parseToolExecutorConfig(expanded);
```

Leave `LoadedServer`, `mergeLoadedLayers`, `loadConfig`, and path helpers unchanged.

- [ ] **Step 2: Run config unit tests**

Run: `yarn vitest run src/config.test.ts`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/config.ts src/config.test.ts
git commit -m "$(cat <<'EOF'
feat(config): port config validation to Effect Schema

EOF
)"
```

---

### Task 6: Red — add `register-tools` tests

**Files:**
- Create: `src/register-tools.test.ts`

- [ ] **Step 1: Write failing tests for list payload + call validation**

Create `src/register-tools.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import {
  buildToolsList,
  callRegisteredTool,
  type EffectToolRegistration,
} from "./register-tools.js";
import {
  SearchToolsInputSchema,
  parseSearchToolsInput,
  type SearchToolsInput,
} from "./schemas.js";

describe("register-tools", () => {
  const searchReg: EffectToolRegistration<SearchToolsInput> = {
    name: "search_tools",
    title: "Search MCP Tools",
    description: "Search tools",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    schema: SearchToolsInputSchema,
    parse: parseSearchToolsInput,
    handler: async (input) => ({
      content: [{ type: "text", text: JSON.stringify(input) }],
    }),
  };

  it("lists JSON Schema derived from Effect Schema", () => {
    const { tools } = buildToolsList([searchReg]);
    expect(tools).toHaveLength(1);
    const tool = tools[0];
    expect(tool.name).toBe("search_tools");
    expect(tool.inputSchema).toMatchObject({
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for finding relevant tools",
        },
      },
      required: expect.arrayContaining(["query"]),
    });
    expect(tool.annotations).toEqual(searchReg.annotations);
  });

  it("rejects invalid tool arguments before calling the handler", async () => {
    await expect(
      callRegisteredTool([searchReg], "search_tools", { query: "" }),
    ).rejects.toThrow(/validation|Invalid|empty|Query/i);
  });

  it("invokes handler with decoded args", async () => {
    const result = await callRegisteredTool([searchReg], "search_tools", {
      query: "diagram",
    });
    expect(result.isError).not.toBe(true);
    const text = result.content[0];
    expect(text.type).toBe("text");
    if (text.type === "text") {
      expect(JSON.parse(text.text)).toMatchObject({
        query: "diagram",
        limit: 5,
        offset: 0,
      });
    }
  });

  it("round-trips Schema.toJsonSchemaDocument for search schema", () => {
    const doc = Schema.toJsonSchemaDocument(SearchToolsInputSchema, {
      additionalProperties: false,
    });
    expect(doc.schema.type).toBe("object");
    expect(doc.schema.additionalProperties).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `yarn vitest run src/register-tools.test.ts`

Expected: FAIL (module not found).

- [ ] **Step 3: Commit**

```bash
git add src/register-tools.test.ts
git commit -m "$(cat <<'EOF'
test(register-tools): add list/call validation coverage

EOF
)"
```

---

### Task 7: Green — implement `src/register-tools.ts`

**Files:**
- Create: `src/register-tools.ts`

- [ ] **Step 1: Implement registrar + pure helpers**

Create `src/register-tools.ts`:

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type CallToolResult,
  type ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import { Schema } from "effect";

export type EffectToolRegistration<I = unknown> = {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly annotations?: ToolAnnotations;
  readonly schema: Parameters<typeof Schema.toJsonSchemaDocument>[0];
  readonly parse: (input: unknown) => I;
  readonly handler: (
    input: I,
  ) => CallToolResult | Promise<CallToolResult>;
};

export function toolInputJsonSchema(
  schema: EffectToolRegistration["schema"],
): Record<string, unknown> {
  const doc = Schema.toJsonSchemaDocument(schema, {
    additionalProperties: false,
  });
  return doc.schema as Record<string, unknown>;
}

export function buildToolsList(
  registrations: ReadonlyArray<EffectToolRegistration>,
): {
  tools: Array<{
    name: string;
    title?: string;
    description?: string;
    inputSchema: Record<string, unknown>;
    annotations?: ToolAnnotations;
  }>;
} {
  return {
    tools: registrations.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: toolInputJsonSchema(tool.schema),
      annotations: tool.annotations,
    })),
  };
}

export async function callRegisteredTool(
  registrations: ReadonlyArray<EffectToolRegistration>,
  name: string,
  args: unknown,
): Promise<CallToolResult> {
  const tool = registrations.find((entry) => entry.name === name);
  if (!tool) {
    throw new McpError(ErrorCode.InvalidParams, `Tool ${name} not found`);
  }
  try {
    const parsed = tool.parse(args ?? {});
    return await tool.handler(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new McpError(
      ErrorCode.InvalidParams,
      `Input validation error: Invalid arguments for tool ${name}: ${message}`,
    );
  }
}

/**
 * Register tools on the underlying MCP `Server` without Zod / `registerTool`.
 * Must be called before any `registerTool` usage (we never call `registerTool`).
 */
export function registerEffectTools(
  mcp: McpServer,
  registrations: ReadonlyArray<EffectToolRegistration>,
): void {
  const byName = new Map(registrations.map((tool) => [tool.name, tool]));

  mcp.server.setRequestHandler(ListToolsRequestSchema, () =>
    buildToolsList(registrations),
  );

  mcp.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const tool = byName.get(name);
    if (!tool) {
      throw new McpError(ErrorCode.InvalidParams, `Tool ${name} not found`);
    }
    try {
      const parsed = tool.parse(request.params.arguments ?? {});
      return await tool.handler(parsed);
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: message }],
        isError: true,
      };
    }
  });
}
```

**Error-path note:** `callRegisteredTool` (used in unit tests) throws `McpError` on validation failure so tests can `rejects.toThrow`. The live `setRequestHandler` for `tools/call` returns `{ isError: true }` for non-`McpError` failures (matches `McpServer.createToolError` behavior). Validation failures from `parse*` are ordinary thrown errors → tool error result. Adjust the live handler to throw `McpError(InvalidParams, ...)` instead if you prefer protocol-level invalid-params; either is acceptable as long as clients see a clear validation failure. Prefer throwing `McpError(InvalidParams, ...)` for decode failures to match the previous SDK path:

```typescript
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Input validation error: Invalid arguments for tool ${name}: ${message}`,
      );
    }
```

Use that preferred catch block in `registerEffectTools`.

- [ ] **Step 2: Run register-tools tests**

Run: `yarn vitest run src/register-tools.test.ts`

Expected: PASS. If `CallToolResult` content typing complains, narrow with the same `type: "text"` checks already in the test.

- [ ] **Step 3: Commit**

```bash
git add src/register-tools.ts src/register-tools.test.ts
git commit -m "$(cat <<'EOF'
feat(mcp): register tools via Effect Schema JSON Schema path

EOF
)"
```

---

### Task 8: Wire `src/index.ts`

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Replace `registerTool` usage with `registerEffectTools`**

Keep dotenv / lifecycle / transport setup. Replace schema imports + three `server.registerTool(...)` blocks with:

```typescript
import {
  SearchToolsInputSchema,
  GetToolSchemaInputSchema,
  ExecuteCodeInputSchema,
  parseSearchToolsInput,
  parseGetToolSchemaInput,
  parseExecuteCodeInput,
} from "./schemas.js";
import { handleSearchTools, handleGetToolSchema, handleExecuteCode } from "./tools/index.js";
import { registerEffectTools } from "./register-tools.js";
import { startLifecycleManagement } from "./sandbox/clients.js";
import { getAvailableClientNames, getSandboxClientBindings } from "./sandbox/runtime.js";

const server = new McpServer({
  name: "@claudikins/tool-executor",
  version: MCP_CLIENT_VERSION,
});

const clientList = getSandboxClientBindings()
  .map((binding) => `- ${binding}`)
  .join("\n");

registerEffectTools(server, [
  {
    name: "search_tools",
    title: "Search MCP Tools",
    description: `Search for MCP tools across all wrapped servers. Returns slim results (name, server, description, example) for discovery.

Use get_tool_schema(name) to get the full inputSchema when you're ready to call a specific tool.

Available categories: code-nav, graph-analysis, knowledge, ai-models, web, ui, reasoning

Example queries:
- "semantic code search" - Serena code navigation
- "impact analysis" - codebase-memory graph analysis
- "generate diagram" - Gemini image/diagram generation
- "fetch webpage" - HTTP fetch tools`,
    schema: SearchToolsInputSchema,
    parse: parseSearchToolsInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: handleSearchTools,
  },
  {
    name: "get_tool_schema",
    title: "Get Tool Schema",
    description: `Get the full inputSchema for a specific tool. Use after search_tools to get parameter details before calling execute_code.

Example: get_tool_schema("gemini-generate-image") - returns full schema with all parameters, types, enums, etc.`,
    schema: GetToolSchemaInputSchema,
    parse: parseGetToolSchemaInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: handleGetToolSchema,
  },
  {
    name: "execute_code",
    title: "Execute Code",
    description: `Execute TypeScript/JavaScript code with access to MCP clients and workspace.

**WORKFLOW** (follow this order):
1. Use search_tools("your query") to find relevant tools
2. Use get_tool_schema("tool_name") to get full parameters
3. Use execute_code to run your code with the discovered tools

If you don't know which tool to use, ALWAYS search first.

**IMPORTANT: Context-Efficient Pattern**
MCP tool responses are auto-saved to workspace when large. Your code receives a reference:
\`\`\`typescript
const result = await gemini["gemini-generate-image"]({...});
// If large: { _savedTo: "mcp-results/123.json", _preview: "..." }
// Read full result: await workspace.readJSON(result._savedTo)
\`\`\`

**Available MCP clients:**
${clientList}
Hyphenated server names are exposed as safe identifiers, e.g. codebase_memory for server codebase-memory.
All clients are also available by original server name through clients["server-name"].

**Workspace API:**
- workspace.write(path, data) / workspace.read(path)
- workspace.writeJSON(path, obj) / workspace.readJSON(path)
- workspace.list(path) / workspace.exists(path)

**Best Practice:** Save outputs to workspace, return minimal confirmation:
\`\`\`typescript
await workspace.writeJSON("analysis.json", results);
console.log("Saved analysis.json");  // Minimal context cost
\`\`\`

Results are summarised if console.log output exceeds ${MAX_LOG_CHARS} chars.`,
    schema: ExecuteCodeInputSchema,
    parse: parseExecuteCodeInput,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    handler: handleExecuteCode,
  },
]);
```

Preserve the existing `main()` / stdin close / transport connect block. Remove the `as unknown as Parameters<typeof server.registerTool>[2]` cast — it should no longer be needed if handler types align; if TypeScript complains about `handleExecuteCode` / `handleSearchTools` return shapes vs `CallToolResult`, cast **only** the handler:

```typescript
handler: handleExecuteCode as EffectToolRegistration["handler"],
```

(import type `EffectToolRegistration` if needed).

- [ ] **Step 2: Typecheck**

Run: `yarn tchk`

Expected: no errors in touched files.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "$(cat <<'EOF'
feat(index): wire MCP tools through Effect registrar

EOF
)"
```

---

### Task 9: Verify success criteria + format

**Files:** none new (verification only; fix lint/format if hooks require)

- [ ] **Step 1: Confirm no application Zod imports**

Run:

```bash
rg -n "from [\"']zod[\"']|from [\"']zod/" src --glob '*.ts'
```

Expected: no matches.

- [ ] **Step 2: Confirm package.json has no direct zod**

Run:

```bash
node -e 'const p=require("./package.json"); if (p.dependencies?.zod||p.devDependencies?.zod) { console.error("zod still listed"); process.exit(1);} console.log("ok: no direct zod");'
```

Expected: `ok: no direct zod`.

- [ ] **Step 3: Run unit tests, types, lint/format**

Run:

```bash
yarn test:unit
yarn tchk
yarn fix
```

Expected: all pass / format clean. Re-stage any oxfmt/oxlint fixes.

- [ ] **Step 4: Final commit if `yarn fix` touched files**

```bash
git add -u src package.json yarn.lock
git status
# only if there are staged changes:
git commit -m "$(cat <<'EOF'
chore: format and lint after Effect Schema port

EOF
)"
```

If nothing to commit, skip.

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Effect Schema SoT in `schemas.ts` / `config.ts` | 3, 5 |
| Remove `zod` from package.json / src imports | 1, 9 |
| `decodeUnknownSync` throwing helpers | 3, 5 |
| JSON Schema via `toJsonSchemaDocument` for MCP list | 6, 7 |
| No `registerTool`; custom list/call | 7, 8 |
| Preserve defaults / bounds / strict tool inputs | 2, 3 |
| Config sync throw-on-invalid via parseLayer | 5 |
| Tests adapted; list/call smoke | 2, 4, 6, 9 |
| No `@effect/schema`; no Effect runtime adoption | 1, 3, 5, 7 |
