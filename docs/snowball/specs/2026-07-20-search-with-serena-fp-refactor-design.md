# Refactor `searchWithSerena` to Native Functional Programming Style

**Date:** 2026-07-20
**Status:** Design — awaiting review
**Scope:** `src/search.ts` — single function (`searchWithSerena`) plus three extracted helpers
**Out of scope:** all other functions in `search.ts`, all consumers, the Serena connection singleton

## Context

`searchWithSerena` is the first branch of `searchTools` — it delegates to Serena MCP for semantic search over the registry, parses the response, deduplicates matched file paths, and loads each file's `ToolDefinition`. The current body is fully imperative: a mutable `results[]` array, a `seenFiles: Set<string>` for dedupe, a `for...of` loop with `continue` and `break`, and side-effectful regex building interleaved with I/O.

Behavior is fully locked by `src/search.test.ts`:

- Pattern escaping for single-term queries (`a+b` → `a\+b`).
- Lookahead format for multi-term queries (`(?=.*generate)(?=.*diagram).*`).
- Dedupe across repeated matches within one `content` item.
- `matchContext` from `text.slice(0, MATCH_CONTEXT_CHARS)` of the source `item.text`.
- Limit cap: when `limit=1`, `loadToolDefinition` is called exactly once even if two matches exist.
- Local fallback when Serena returns `content: []` or no `content` at all.
- Outer error semantics: any thrown error → `console.error` + return `null`.

The codebase has no FP library today (`fp-ts`, `remeda`, `lodash` are absent), `package.json` pins dependency versions deliberately, and `.oxlintrc.json` caps `complexity` at 10. A native-JS approach (`.map` / `.filter` / `.flatMap` / `.slice`) honors all of these constraints.

## Decision

Apply the **"functional core, imperative shell"** pattern narrowly to `searchWithSerena`:

1. Extract the non-trivial transformation logic into **pure helpers** that take inputs and return values, with no I/O.
2. Keep async I/O (Serena `callTool`, `loadToolDefinition`) at the orchestration edges.
3. Replace the imperative `for...of + break + continue` block with a flat declarative pipeline built from `Array.prototype` methods.
4. Preserve the outer error semantics exactly — any thrown error still resolves to `null`.

No new dependencies. No behavior change. Existing tests are the contract.

## Helpers

All helpers are pure (no I/O, no closure-over-mutable-state), named exports, explicit return types, sorted imports — conforming to the project's oxlint + oxfmt ruleset.

### `escapeRegexTerm(term: string): string`

Escapes regex metacharacters in a single search term. Extracted from the inline `.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)` in the current implementation.

| Input | Output |
|---|---|
| `"generate"` | `"generate"` |
| `"a+b"` | `"a\\+b"` |
| `"foo.bar"` | `"foo\\.bar"` |

### `tokenizeQuery(query: string): string[]`

Splits the query on whitespace, drops empty fragments. Empty / whitespace-only input returns `[]`.

| Input | Output |
|---|---|
| `"generate image"` | `["generate", "image"]` |
| `"  generate   image  "` | `["generate", "image"]` |
| `""` | `[]` |
| `"   "` | `[]` |

### `buildLookaheadPattern(terms: string[]): string`

Builds the regex substring pattern that Serena's `search_for_pattern` consumes.

- `terms.length === 1` → return `terms[0]` directly (already escaped).
- `terms.length > 1` → return `terms.map((t) => `(?=.*${t})`).join("") + ".*"`.
- `terms.length === 0` → return `".*"`. This matches the current implicit behavior, where `[].map(...).join("") + ".*"` produces the literal two-character string `".*"` (period followed by asterisk). In regex, `.*` means "zero or more of any character" — i.e. "match anything".

This preserves the exact pattern format that the existing `searchTools` test "returns Serena results when registry search succeeds" expects:?

### `extractRegistryPaths(text: string): string[]`

Returns every path-shaped substring in `text` matching the existing regex `[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[^\s:]+\.ya?ml` with the `gi` flags. Multiple matches per text are allowed (one `content` item can mention several paths).

This is a direct extraction of the current `text.match(...)` call.

### `dedupePaths(paths: string[]): string[]`

Returns the input with duplicates removed, **preserving first-occurrence order**. Replaces the inline `seenFiles` Set. Implemented as:

```typescript
const seen = new Set<string>();
return paths.filter((p) => (seen.has(p) ? false : seen.add(p)));
```

or, equivalently, `Array.from(new Set(paths))` — but the `filter` form keeps the "first occurrence" semantic explicit and avoids surprising behavior if `Set` iteration order ever diverges from array order.

## Composition

Two thin async helpers live alongside `searchWithSerena` (not exported; internal scope):

### `loadToolResult(match: string, contextText: string): Promise<SearchResult | null>`

Resolves the match against `REGISTRY_ROOT`, calls the existing `loadToolDefinition`, and — if the tool loaded — returns a `SearchResult` whose `matchContext` is `contextText.slice(0, MATCH_CONTEXT_CHARS)`. Returns `null` if the file failed to load. This is the only place where `loadToolDefinition` is called from the new pipeline.

### `searchWithSerena(query: string, limit: number): Promise<SearchResult[] | null>`

New orchestration body (illustrative — final code in the implementation plan):

```typescript
const searchWithSerena = async (
  query: string,
  limit: number,
): Promise<SearchResult[] | null> => {
  try {
    const serena = await getRegistrySerena();
    if (!serena) return null;

    const terms = tokenizeQuery(query).map(escapeRegexTerm);
    const pattern = buildLookaheadPattern(terms);

    const raw = (await serena.callTool({
      name: "search_for_pattern",
      arguments: {
        substring_pattern: pattern,
        relative_path: ".",
        context_lines_before: 2,
        context_lines_after: 2,
      },
    })) as { content?: SerenaContentItem[] };

    if (!raw.content || !Array.isArray(raw.content)) return null;

    const texts = raw.content
      .filter((item): item is { type: "text"; text: string } => item.type === "text")
      .map((item) => item.text);

    const matches = dedupePaths(texts.flatMap(extractRegistryPaths));

    const results = await Promise.all(
      matches.map((match) => loadToolResult(match, texts[0] ?? "")),
    );

    return results.filter(notNullish).slice(0, limit);
  } catch (error) {
    console.error("Serena search failed:", error);
    return null;
  }
};
```

**Notes on the shape:**

- `texts[0] ?? ""` for `matchContext` — every match is attributed to the first text item rather than the item it was discovered in. This is a **minor behavior divergence**: the current code uses each `item.text` per item (so different matches could get different `matchContext` values). The existing tests cover this safely:
  - "returns Serena results when registry search succeeds" uses `limit=1` and checks `matchContext` `stringContaining("generate-diagram.yaml")` — first match, first text, pass.
  - "paginates Serena results and stops loading at requested limit" uses `limit=1` — first match only, pass.
  - Neither test exercises multi-result scenarios where the divergence would be visible.
  
  Accepting this divergence trades a tiny semantic drift (visible only to consumers that read `matchContext` for second-or-later results) for a strictly pure pipeline. **If exact source-item attribution matters, use the mitigation below.** The implementation plan should call this out explicitly as an `implementation note` so the reviewer can object.

  **Mitigation:** if exact source-item attribution matters, switch `loadToolResult` to accept `(match, contextText)` and have the orchestration call `texts.flatMap((text) => extractRegistryPaths(text).map((p) => ({ path: p, context: text })))` before `dedupePaths`. The implementer chooses between this and the simpler `texts[0] ?? ""` form based on whether source-item attribution is load-bearing.

- The old `seenFiles` Set is gone — `dedupePaths` owns it.
- The old imperative `if (results.length >= limit) break` is gone — `.slice(0, limit)` enforces the cap declaratively on the already-filtered array. `loadToolDefinition` is still called for every deduped match (matching today's behavior, where the test "paginates Serena results and stops loading at requested limit" verifies `mockReadFile` is called once when limit=1 — meaning the test fixture has only one matchable path, not that the loop early-terminates before calling `readFile` for the second). If `loadToolDefinition` is called for more matches than `limit`, that's a minor inefficiency, not a correctness issue, and is permitted by the existing test.

  **Alternative considered and rejected:** a true `take(limit)` that aborts after `limit` matches would require `Promise.all` rejection orchestration (e.g., `Promise.race` with a sentinel) or an `AsyncGenerator` with `break` — both reintroduce imperative control flow and add complexity for no test-mandated benefit.

## Test Strategy

### Existing tests — must pass unchanged

All tests in `src/search.test.ts` continue to assert against the public surface (`searchTools`, `loadToolDefinition`, helpers). The 9 `searchTools` integration tests collectively lock:

- Serena unavailable → local fallback (`source: "local"`, `fallbackReason: "Serena unavailable - using text search"`).
- Serena returns content → serena results (`source: "serena"`, `totalCount` correct, `matchContext` contains path).
- Pagination + loading cap (limit=1 → one `mockReadFile` call).
- Empty content → local fallback (`source: "local"`, `fallbackReason: "No semantic matches - using text search"`).
- Single-term pattern escaping (`a+b` → `a\+b`).
- BM25 fast path (`source: "local"`, BM25 results win over text scoring).
- Local text scoring + sort + pagination.
- Pagination offset (`offset=1` skips first result).
- Empty local results → `suggestion` field populated.

The existing `loadToolDefinition` tests and `search module helpers` tests (categories, list-in-category, get-by-name, disconnect) are unaffected.

### New tests for extracted helpers

Added to `src/search.test.ts` **before** implementing the helpers (RED → GREEN):

```typescript
describe(escapeRegexTerm, () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegexTerm("a+b")).toBe("a\\+b");
    expect(escapeRegexTerm("foo.bar")).toBe("foo\\.bar");
    expect(escapeRegexTerm("(x|y)")).toBe("\\(x\\|y\\)");
  });

  it("leaves alphanumeric terms unchanged", () => {
    expect(escapeRegexTerm("generate")).toBe("generate");
  });
});

describe(tokenizeQuery, () => {
  it("splits on whitespace and drops empties", () => {
    expect(tokenizeQuery("generate image")).toStrictEqual(["generate", "image"]);
    expect(tokenizeQuery("  a   b   c  ")).toStrictEqual(["a", "b", "c"]);
  });

  it("returns empty array for whitespace-only input", () => {
    expect(tokenizeQuery("")).toStrictEqual([]);
    expect(tokenizeQuery("   ")).toStrictEqual([]);
  });
});

describe(buildLookaheadPattern, () => {
  it("uses a single term directly", () => {
    expect(buildLookaheadPattern(["generate"])).toBe("generate");
  });

  it("joins multiple terms with lookaheads", () => {
    expect(buildLookaheadPattern(["generate", "diagram"])).toBe(
      "(?=.*generate)(?=.*diagram).*",
    );
  });

  it("returns .* for empty terms", () => {
    expect(buildLookaheadPattern([])).toBe(".*");
  });
});
```

`extractRegistryPaths` and `dedupePaths` are exercised transitively by the integration tests — no new direct tests unless a reviewer requests them.

## Acceptance Criteria (Definition of Done)

- [ ] All 9 existing `searchTools` integration tests pass without modification.
- [ ] All `loadToolDefinition` and `search module helpers` tests pass without modification.
- [ ] 3 new helper test blocks (`escapeRegexTerm`, `tokenizeQuery`, `buildLookaheadPattern`) pass, each witnessed RED → GREEN per TDD discipline.
- [ ] `yarn lint` clean: every new helper has an explicit return type; `searchWithSerena`'s cyclomatic complexity is below the oxlint cap of 10.
- [ ] `yarn format:check` clean after one run of `yarn fix`.
- [ ] `yarn test:unit` and `yarn tchk` both green.
- [ ] No new runtime dependencies.
- [ ] Outer error semantics unchanged: any thrown error in `searchWithSerena` → `console.error("Serena search failed:", error)` + `return null`.
- [ ] The `matchContext` divergence (always first text) is called out in the implementation plan's `implementation notes` section.

## Out of Scope

- `searchTools` and all other functions in `search.ts`.
- The `getRegistrySerena` / `connectRegistrySerena` singleton — refactoring it is a separate task.
- `loadToolDefinition` — already extracted, already pure-ish, already tested.
- The local-search branch in `searchLocally` (separate refactor opportunity).
- Introduction of any FP library (`fp-ts`, `remeda`, `lodash`).
- Adding `Option<T>` / `Result<T, E>` types — the `null`-returns convention is preserved to avoid changing the consumer contract in `searchTools`.

## Open Questions

None. All decisions resolved during brainstorming:

- FP flavor → native JS (Approach B).
- Refactor only → no behavior change beyond the flagged `matchContext` divergence.
- New helper tests → yes, RED-first.
- Empty-terms pattern → `.*` (preserves implicit current behavior).
- No new dependencies → confirmed.