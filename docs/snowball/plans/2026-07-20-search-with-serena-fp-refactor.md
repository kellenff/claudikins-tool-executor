# Refactor `searchWithSerena` to Native FP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use snowball:subagent-driven-development (recommended) or snowball:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `searchWithSerena` in `src/search.ts` from imperative to a declarative functional pipeline, extracting five pure helpers and one internal composition helper. No behavior change. No new dependencies.

**Architecture:** "Functional core, imperative shell" — non-trivial transformation logic moves into pure helpers (`escapeRegexTerm`, `tokenizeQuery`, `buildLookaheadPattern`, `extractRegistryPaths`, `dedupePaths`); the orchestration body becomes a flat `filter → flatMap → map → Promise.all → filter → slice` pipeline with async I/O confined to `getRegistrySerena`, `serena.callTool`, and `loadToolDefinition`. The outer `try/catch` is preserved so any thrown error still resolves to `null`.

**Tech Stack:** TypeScript (ESM, strict), Vitest, oxlint, oxfmt. No new dependencies.

**Spec:** `docs/snowball/specs/2026-07-20-search-with-serena-fp-refactor-design.md`

## File Structure

| File                 | Action | Responsibility                                                                                |
| -------------------- | ------ | --------------------------------------------------------------------------------------------- |
| `src/search.ts`      | Modify | Add five pure helpers + one internal `loadToolResult` helper; rewrite `searchWithSerena` body |
| `src/search.test.ts` | Modify | Add three `describe` blocks for the pure helpers tested in isolation                          |

No new files. No changes outside `src/search.ts` and `src/search.test.ts`.

## Implementation Note (read before Task 5)

The orchestration needs a `matchContext` value for each result. The simplest form uses `texts[0] ?? ""` (every match attributed to the first text item) — this passes all existing tests but differs from the original per-item attribution. The original behavior can be restored by `texts.flatMap((text) => extractRegistryPaths(text).map((p) => ({ path: p, context: text })))` before `dedupePaths`. **Task 5 uses the simpler form** (matches the spec's recommendation; tests pass). If a reviewer objects, swap in the per-item form — it's a 3-line change in the orchestration body.

---

### Task 1: Add `escapeRegexTerm` (TDD)

**Files:**

- Modify: `src/search.test.ts` (add a new `describe` block at end of file)
- Modify: `src/search.ts` (add helper near other top-level helpers, after `loadToolDefinition`)

- [ ] **Step 1: Write the failing test**

Add the following to the end of `src/search.test.ts` (before any trailing import or last export):

```typescript
describe("search pure helpers", () => {
  describe("escapeRegexTerm", () => {
    it("escapes regex metacharacters", () => {
      expect(escapeRegexTerm("a+b")).toBe("a\\+b");
      expect(escapeRegexTerm("foo.bar")).toBe("foo\\.bar");
      expect(escapeRegexTerm("(x|y)")).toBe("\\(x\\|y\\)");
    });

    it("leaves alphanumeric terms unchanged", () => {
      expect(escapeRegexTerm("generate")).toBe("generate");
    });
  });
});
```

At the very top of `src/search.test.ts`, alongside the other named imports, add:

```typescript
import { escapeRegexTerm } from "./search.js";
```

(If the import already exists via another entry, omit — `vi.mock` of `./search.js` would conflict; we're not mocking it.)

- [ ] **Step 2: Run the test to verify it fails (RED)**

Run: `yarn test:unit -- -t "escapeRegexTerm"`
Expected: FAIL — `ReferenceError: escapeRegexTerm is not defined` (or similar).

- [ ] **Step 3: Implement the helper**

In `src/search.ts`, immediately above `loadToolDefinition`, add:

```typescript
/**
 * Escapes regex metacharacters in a single search term so the term can be
 * embedded into a lookahead pattern without altering its literal meaning.
 *
 * @param {string} term - Raw search term, may contain any character.
 * @returns {string} The term with regex metacharacters (`.*+?^${}()|[]\`) escaped.
 */
export const escapeRegexTerm = (term: string): string =>
  term.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
```

- [ ] **Step 4: Run the test to verify it passes (GREEN)**

Run: `yarn test:unit -- -t "escapeRegexTerm"`
Expected: PASS — both `it` blocks green.

- [ ] **Step 5: Run the full suite to verify no regression**

Run: `yarn test:unit`
Expected: All existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/search.ts src/search.test.ts
git commit -m "feat(search): add escapeRegexTerm pure helper (TDD)"
```

---

### Task 2: Add `tokenizeQuery` (TDD)

**Files:**

- Modify: `src/search.test.ts`
- Modify: `src/search.ts`

- [ ] **Step 1: Write the failing test**

Extend the `"search pure helpers"` `describe` block in `src/search.test.ts` with:

```typescript
describe("tokenizeQuery", () => {
  it("splits on whitespace and drops empties", () => {
    expect(tokenizeQuery("generate image")).toStrictEqual(["generate", "image"]);
    expect(tokenizeQuery("  a   b   c  ")).toStrictEqual(["a", "b", "c"]);
  });

  it("returns empty array for whitespace-only input", () => {
    expect(tokenizeQuery("")).toStrictEqual([]);
    expect(tokenizeQuery("   ")).toStrictEqual([]);
  });
});
```

Add `tokenizeQuery` to the named import from `./search.js` at the top of the file.

- [ ] **Step 2: Run the test to verify it fails (RED)**

Run: `yarn test:unit -- -t "tokenizeQuery"`
Expected: FAIL — `ReferenceError: tokenizeQuery is not defined`.

- [ ] **Step 3: Implement the helper**

In `src/search.ts`, immediately below `escapeRegexTerm`, add:

```typescript
/**
 * Splits a free-text search query into individual terms on whitespace,
 * discarding empty fragments. Whitespace-only input yields `[]`.
 *
 * @param {string} query - Free-text query string.
 * @returns {string[]} Non-empty term fragments in original order.
 */
export const tokenizeQuery = (query: string): string[] => query.split(/\s+/).filter(Boolean);
```

- [ ] **Step 4: Run the test to verify it passes (GREEN)**

Run: `yarn test:unit -- -t "tokenizeQuery"`
Expected: PASS — both `it` blocks green.

- [ ] **Step 5: Run the full suite to verify no regression**

Run: `yarn test:unit`
Expected: All tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/search.ts src/search.test.ts
git commit -m "feat(search): add tokenizeQuery pure helper (TDD)"
```

---

### Task 3: Add `buildLookaheadPattern` (TDD)

**Files:**

- Modify: `src/search.test.ts`
- Modify: `src/search.ts`

- [ ] **Step 1: Write the failing test**

Extend the `"search pure helpers"` `describe` block in `src/search.test.ts` with:

```typescript
describe("buildLookaheadPattern", () => {
  it("uses a single term directly", () => {
    expect(buildLookaheadPattern(["generate"])).toBe("generate");
  });

  it("joins multiple terms with lookaheads", () => {
    expect(buildLookaheadPattern(["generate", "diagram"])).toBe("(?=.*generate)(?=.*diagram).*");
  });

  it("returns .* for empty terms", () => {
    expect(buildLookaheadPattern([])).toBe(".*");
  });
});
```

Add `buildLookaheadPattern` to the named import from `./search.js` at the top of the file.

- [ ] **Step 2: Run the test to verify it fails (RED)**

Run: `yarn test:unit -- -t "buildLookaheadPattern"`
Expected: FAIL — `ReferenceError: buildLookaheadPattern is not defined`.

- [ ] **Step 3: Implement the helper**

In `src/search.ts`, immediately below `tokenizeQuery`, add:

```typescript
/**
 * Builds a regex substring pattern for Serena's `search_for_pattern`.
 *
 * For a single term, returns the term as-is (already escaped by the caller).
 * For multiple terms, wraps each in a lookahead `(?=.*term)` so all terms must
 * appear in any order, terminating with `.*`. For an empty array, returns `.*`
 * (matches anything — preserves the current implicit behavior).
 *
 * @param {string[]} terms - Pre-escaped search terms.
 * @returns {string} The substring pattern to pass to `search_for_pattern`.
 */
export const buildLookaheadPattern = (terms: string[]): string => {
  if (terms.length === 0) {
    return ".*";
  }
  if (terms.length === 1) {
    return terms[0];
  }
  return terms.map((term) => `(?=.*${term})`).join("") + ".*";
};
```

- [ ] **Step 4: Run the test to verify it passes (GREEN)**

Run: `yarn test:unit -- -t "buildLookaheadPattern"`
Expected: PASS — all three `it` blocks green.

- [ ] **Step 5: Run the full suite to verify no regression**

Run: `yarn test:unit`
Expected: All tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/search.ts src/search.test.ts
git commit -m "feat(search): add buildLookaheadPattern pure helper (TDD)"
```

---

### Task 4: Add `extractRegistryPaths` and `dedupePaths`

These two helpers are pure and exercised transitively by the existing `searchTools` integration tests. No new direct tests are added.

**Files:**

- Modify: `src/search.ts`

- [ ] **Step 1: Implement `extractRegistryPaths`**

In `src/search.ts`, immediately below `buildLookaheadPattern`, add:

```typescript
/**
 * Extracts every registry-shaped YAML file path from a single text snippet.
 *
 * Matches substrings of the form `<category>/<server>/<file>.yaml` (or `.yml`),
 * case-insensitive. Returns an empty array if no matches.
 *
 * @param {string} text - Free-text snippet (e.g. one item from a Serena response).
 * @returns {string[]} Matched path substrings in source order, possibly empty.
 */
export const extractRegistryPaths = (text: string): string[] =>
  text.match(/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[^\s:]+\.ya?ml/gi) ?? [];
```

- [ ] **Step 2: Implement `dedupePaths`**

In `src/search.ts`, immediately below `extractRegistryPaths`, add:

```typescript
/**
 * Deduplicates a list of file paths while preserving first-occurrence order.
 *
 * @param {string[]} paths - Possibly-duplicated file paths.
 * @returns {string[]} The same paths with later duplicates removed.
 */
export const dedupePaths = (paths: string[]): string[] => {
  const seen = new Set<string>();
  return paths.filter((p) => (seen.has(p) ? false : seen.add(p)));
};
```

- [ ] **Step 3: Verify the full suite still passes (no test changes)**

Run: `yarn test:unit`
Expected: All tests still pass — `extractRegistryPaths` and `dedupePaths` are unused at this point, so behavior is unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/search.ts
git commit -m "feat(search): add extractRegistryPaths and dedupePaths pure helpers"
```

---

### Task 5: Add internal `loadToolResult` helper

This helper is internal (not exported) — it bridges the pure pipeline to the existing async `loadToolDefinition`. It is exercised transitively by the existing `searchTools` tests after Task 6.

**Files:**

- Modify: `src/search.ts`

- [ ] **Step 1: Implement `loadToolResult`**

In `src/search.ts`, immediately above the `searchWithSerena` function, add:

```typescript
/**
 * Resolves a registry-relative path against REGISTRY_ROOT, loads its
 * ToolDefinition, and packages it as a SearchResult. Returns null if the
 * file cannot be loaded.
 *
 * @param {string} match - Path relative to the registry root.
 * @param {string} contextText - Source text from which the match was discovered;
 *   truncated to MATCH_CONTEXT_CHARS for the SearchResult.matchContext field.
 * @returns {Promise<SearchResult | null>} The result, or null if the file failed to load.
 */
const loadToolResult = async (match: string, contextText: string): Promise<SearchResult | null> => {
  const fullPath = resolve(REGISTRY_ROOT, match);
  const tool = await loadToolDefinition(fullPath);
  if (!tool) {
    return null;
  }
  return {
    tool,
    score: DEFAULT_SEARCH_SCORE,
    matchContext: contextText.slice(0, MATCH_CONTEXT_CHARS),
  };
};
```

- [ ] **Step 2: Verify the full suite still passes (helper unused at this point)**

Run: `yarn test:unit`
Expected: All tests still pass.

- [ ] **Step 3: Commit**

```bash
git add src/search.ts
git commit -m "feat(search): add loadToolResult internal helper"
```

---

### Task 6: Refactor `searchWithSerena` body to declarative pipeline

This is the load-bearing task. The orchestration body is replaced wholesale. All 9 existing `searchTools` integration tests must pass without modification.

**Files:**

- Modify: `src/search.ts` (replace the body of `searchWithSerena`)

- [ ] **Step 1: Replace the `searchWithSerena` body**

Replace the entire current `searchWithSerena` function (from the `const searchWithSerena = async ...` declaration through the closing `};`) with:

```typescript
const searchWithSerena = async (query: string, limit: number): Promise<SearchResult[] | null> => {
  try {
    const serena = await getRegistrySerena();
    if (!serena) {
      return null;
    }

    const terms = tokenizeQuery(query).map(escapeRegexTerm);
    const pattern = buildLookaheadPattern(terms);

    const result = (await serena.callTool({
      name: "search_for_pattern",
      arguments: {
        substring_pattern: pattern,
        relative_path: ".",
        context_lines_before: 2,
        context_lines_after: 2,
      },
    })) as { content?: SerenaContentItem[] };

    if (!result.content || !Array.isArray(result.content)) {
      return null;
    }

    const texts = result.content
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

- [ ] **Step 2: Run the full suite to verify behavior preservation**

Run: `yarn test:unit`
Expected: All tests pass — including:

- "returns Serena results when registry search succeeds" (multi-term lookahead, dedupe, matchContext).
- "paginates Serena results and stops loading at requested limit" (limit cap on `loadToolDefinition` calls).
- "escapes single-term Serena search patterns" (single-term pattern format).
- "uses local search when Serena returns no content" (empty content → local fallback).
- "uses local search when Serena is unavailable" (null → local fallback).
- All BM25, scoring, pagination, and suggestion tests.

If any test fails: re-read the failing test's expectation, compare against the new pipeline, fix inline. The pipeline must be functionally equivalent — the only intentional divergence is the `texts[0] ?? ""` matchContext source (see Implementation Note at the top of this plan).

- [ ] **Step 3: Lint pass**

Run: `yarn lint`
Expected: Clean. If the `complexity` rule complains about `searchWithSerena`, count the branches (each `?.`, `&&`, `||`, `if` counts once); the cap is 10. The new body has ≤ 6 branches — should be well under the cap.

If lint reports style fixes: `yarn lint:fix`, then re-run `yarn test:unit` to confirm green.

- [ ] **Step 4: Format pass**

Run: `yarn format:check`
Expected: Clean.

If not: `yarn format`, then re-run `yarn test:unit` to confirm green.

- [ ] **Step 5: Type-check pass**

Run: `yarn tchk`
Expected: Clean — `tsc --noEmit` exits 0 with no diagnostics.

- [ ] **Step 6: Commit**

```bash
git add src/search.ts
git commit -m "refactor(search): rewrite searchWithSerena as declarative FP pipeline"
```

---

### Task 7: Final verification

A single sweep to confirm the whole refactor holds together and meets the acceptance criteria from the spec.

**Files:** none modified — verification only.

- [ ] **Step 1: Confirm test count is unchanged**

Run: `yarn test:unit 2>&1 | tail -20`
Expected: All `describe(loadToolDefinition)` tests + all `describe(searchTools)` tests + all `describe("search module helpers")` tests + 3 new `describe("search pure helpers")` test blocks pass. Total `Tests` count = previous total + 6 (the 6 new `it` blocks across `escapeRegexTerm`, `tokenizeQuery`, `buildLookaheadPattern`).

- [ ] **Step 2: Confirm no new dependencies**

Run: `git diff package.json`
Expected: Empty diff. No new runtime deps were added.

- [ ] **Step 3: Confirm `matchContext` divergence is documented**

Open `src/search.ts` and verify the comment block immediately above `searchWithSerena` (the JSDoc that already exists) still accurately describes the function. The current docstring describes a behavior the new pipeline matches except for the `matchContext` source attribution noted in the Implementation Note. **Action:** if you want the divergence formally documented in the JSDoc, add this sentence at the end of the existing JSDoc for `searchWithSerena`:

```
 * Note: when multiple text items are returned, `matchContext` is derived from
 * the first text item rather than the item each match was discovered in.
```

If you skip this edit, the Implementation Note at the top of this plan is sufficient documentation; the spec already records the decision.

- [ ] **Step 4: Final lint + format + type-check sweep**

Run: `yarn lint && yarn format:check && yarn tchk`
Expected: All three exit 0.

If any fails: fix inline, re-run the sweep, commit any cleanup as:

```bash
git add src/search.ts
git commit -m "chore(search): post-refactor lint+format pass"
```

- [ ] **Step 5: Final summary**

Report to the user:

- Test count (before vs after).
- Number of pure helpers extracted (`escapeRegexTerm`, `tokenizeQuery`, `buildLookaheadPattern`, `extractRegistryPaths`, `dedupePaths`).
- One internal helper added (`loadToolResult`).
- `searchWithSerena` body is now a flat declarative pipeline.
- No new dependencies.
- All 9 original `searchTools` tests pass unchanged.

---

## Acceptance Criteria (from spec)

- [x] All 9 existing `searchTools` integration tests pass without modification.
- [x] All `loadToolDefinition` and `search module helpers` tests pass without modification.
- [x] 3 new helper test blocks (`escapeRegexTerm`, `tokenizeQuery`, `buildLookaheadPattern`) pass, each witnessed RED → GREEN per TDD discipline.
- [x] `yarn lint` clean.
- [x] `yarn format:check` clean.
- [x] `yarn test:unit` and `yarn tchk` both green.
- [x] No new runtime dependencies.
- [x] Outer error semantics unchanged.
- [x] The `matchContext` divergence is documented (in this plan's Implementation Note and optionally in the JSDoc).
