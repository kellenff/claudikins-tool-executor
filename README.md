<p align="center">
  <img src="assets/banner.png" alt="claudikins-tool-executor" width="100%">
</p>

<p align="center">
  <a href="https://github.com/elb-pr/claudikins-tool-executor/commits/main"><img src="https://img.shields.io/github/last-commit/elb-pr/claudikins-tool-executor?style=flat-square" alt="Last Commit"></a>
  <img src="https://img.shields.io/badge/node-18%2B-brightgreen?style=flat-square" alt="Node.js 18+">
  <img src="https://img.shields.io/npm/v/@claudikins/tool-executor?style=flat-square&color=cb3837" alt="npm">
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/Claude%20Code-plugin-D97757?style=flat-square&logo=claude&logoColor=white" alt="Claude Code Plugin">
</p>

<h1 align="center">Tool Executor</h1>

<p align="center">
  <strong>Loading 100+ MCP tools into Claude Code burns 55k tokens before you type a word,<br>
  and chaining them together is agonizingly slow.</strong><br><br>
  Tool Executor gives Claude Code a sandboxed TypeScript environment to search, batch-execute,<br>
  and auto-save tool results autonomously — cutting context overhead by <strong>98%</strong>.
</p>

<p align="center">
  <a href="#install--see-it-work">Get Started</a> ·
  <a href="#the-3-tool-workflow">How It Works</a> ·
  <a href="#wrapped-servers">Wrapped Servers</a> ·
  <a href="#graph-intelligence">Graph Intelligence</a> ·
  <a href="#add-your-own">Configuration</a>
</p>

---

## Install & See It Work

```bash
# Add the Claudikins marketplace
/marketplace add elb-pr/claudikins-marketplace

# Install the plugin
/plugin install claudikins-tool-executor
```

Restart Claude Code. That's it — 110 tools available, 3 exposed.

### First Workflow

Ask Claude anything that benefits from specialized tools:

```
Research the latest MCP server patterns and generate a diagram of the architecture.
```

Claude will:

1. Call `search_tools` to find relevant research and image generation tools
2. Call `get_tool_schema` to load exact parameters for each
3. Call `execute_code` once — running this in the sandbox:

```typescript
// Claude writes and executes this as a single batched call
const research = await gemini["gemini-deep-research"]({
  query: "latest MCP server patterns and architecture",
});

const diagram = await gemini["gemini-generate-image"]({
  prompt: "MCP server architecture diagram, clean technical style",
  aspectRatio: "16:9",
});

// Large responses auto-saved — context stays lean
if (research._savedTo) {
  const full = await workspace.readJSON(research._savedTo);
  await workspace.writeJSON("research-summary.json", full);
}

console.log("Research saved. Diagram:", diagram.url);
```

Two tools called. One return. No serial waiting.

---

## The 3-Tool Workflow

Tool Executor exposes exactly 3 tools to Claude Code. Everything else happens inside the sandbox.

```
search_tools("intent")  →  get_tool_schema("name")  →  execute_code(typescript)
```

### `search_tools` — Find by Intent

Semantic search over all 110 wrapped tools. Describe what you need; get back names, servers, and descriptions — no schemas loaded yet.

```json
{ "query": "generate images", "limit": 5 }
```

Returns slim results: name, server, 80-char description. **~1.1k tokens total** for the full tool surface.

### `get_tool_schema` — Load on Demand

Fetch the full JSON Schema for a specific tool. Only pay the token cost when you're ready to call it.

```json
{ "name": "gemini-generate-image" }
```

### `execute_code` — Run in the Sandbox

TypeScript execution with pre-connected MCP clients. Write code that calls multiple tools, branches on results, loops — Claude returns once with everything done.

```typescript
const client = gemini; // pre-connected, no setup
const result = await client["gemini-generate-image"]({ prompt: "..." });
```

### Workflow Guidance

The session hook injects a standard MCP-first workflow for each prompt:

```
Identify if MCP helps → if so, run search_tools first
```
This keeps MCP usage discoverable while still allowing Claude to proceed when MCP is not the right fit.

---

## The Execution Gap

This isn't a limitation of Claude. It's a structural gap between how the Anthropic API works and how Claude Code works.

| Aspect               | Anthropic API               | Claude Code (native)      | Tool Executor                |
| -------------------- | --------------------------- | ------------------------- | ---------------------------- |
| Schema loading       | Developer-controlled        | All upfront (~55k tokens) | Lazy — search on demand      |
| Execution model      | Batched (N tools, 1 return) | Serial (pause per tool)   | Batched (TypeScript sandbox) |
| Large responses      | Developer-managed           | Dumped to context         | Auto-saved to workspace      |
| Protocol enforcement | Code                        | None                      | Hook-gated                   |

**Context cost in practice:**

```
Native Claude Code with 8 MCP servers:
  110 tools × avg 500 tokens/schema = ~55,000 tokens

Tool Executor:
  3 tool definitions × ~370 tokens each = ~1,100 tokens

Savings: ~98%
```

The API gives developers programmatic control over every tool call. Claude Code users get serial execution and a context window that fills before the conversation starts. Tool Executor imports the API execution model into the IDE — without leaving Claude Code.

---

## Wrapped Servers

110 tools across 8 servers. All are discoverable via `search_tools`, and executable in the sandbox when the underlying server command is available.

### Research & Generation

| Server   | Tools | Capabilities                                                                                                                                             |
| -------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gemini` | 37    | Deep research agent, Claude+Gemini brainstorming, code analysis, structured output, 4K image generation, video generation, text-to-speech, Google Search |

### Code Intelligence

| Server            | Tools | Capabilities                                                                                 |
| ----------------- | ----- | -------------------------------------------------------------------------------------------- |
| `serena`          | 29    | Semantic symbol search, rename/refactor, file operations, shell execution, persistent memory |
| `codebase-memory` | 14    | Graph-based code analysis — see [Graph Intelligence](#graph-intelligence)                    |

In `execute_code`, `codebase-memory` is exposed as `codebase_memory` because JavaScript identifiers cannot contain hyphens. The original server name is also available as `clients["codebase-memory"]`.

### Web & Data

| Server  | Tools | Capabilities                                                      |
| ------- | ----- | ----------------------------------------------------------------- |
| `apify` | 7     | Actor-based web scraping, RAG browser, structured data extraction |

### Knowledge & Docs

| Server       | Tools | Capabilities                                              |
| ------------ | ----- | --------------------------------------------------------- |
| `context7`   | 2     | Library documentation lookup, version-aware API reference |
| `notebooklm` | 16    | Notebook management, Q&A, research synthesis              |

### Reasoning

| Server               | Tools | Capabilities                                      |
| -------------------- | ----- | ------------------------------------------------- |
| `sequentialThinking` | 1     | Multi-step reasoning with explicit thought chains |

### UI Components

| Server   | Tools | Capabilities                                                 |
| -------- | ----- | ------------------------------------------------------------ |
| `shadcn` | 4     | Component search, implementation examples, Tailwind variants |

> **Note:** Serena is required — it powers `search_tools` discovery in addition to being a full sandbox client. All other servers are optional; configure your own in `tool-executor.config.json`.

### Add Your Own

Any MCP server can be wrapped. Create `tool-executor.config.json`:

```json
{
  "servers": [
    {
      "name": "myserver",
      "displayName": "My Server",
      "command": "npx",
      "args": ["-y", "my-mcp-package"],
      "trusted": true,
      "env": { "API_KEY": "${MY_API_KEY}" }
    }
  ]
}
```

Tip: For custom command wrappers, include `"trusted": true` when `command` is not one of the built-in launcher patterns (`npx`, `uvx`, `node`, `python`, `codebase-memory-mcp`) or an explicit path.

Run `npm run extract` to generate registry entries. Your tools are now searchable.

---

## Graph Intelligence

> **New in v1.1.0**

Once you have cheap context and batched execution, the question becomes: what do you do with it?

`codebase-memory-mcp` answers that for codebases. It pre-indexes your repository into a knowledge graph, then exposes 14 tools for traversal, analysis, and architectural reasoning — all accessible through the same `search_tools → execute_code` workflow.

**This is not grep.** It's the difference between Claude reading your files and Claude understanding how your code is connected.

### Index Your Repository

```typescript
// One-time setup — index the codebase into the graph
await codebase_memory["index_repository"]({
  repo_path: "/path/to/repo",
});
```

### What Becomes Possible

**Find what calls what — across your entire codebase:**

```typescript
const callers = await codebase_memory["trace_path"]({
  project: "my-project",
  function_name: "handleAuth",
  mode: "calls",
});
// Returns: every function in the call chain, with file paths and line numbers
```

**Know impact analysis before you refactor:**

```typescript
const impact = await codebase_memory["detect_changes"]({
  project: "my-project",
  base_branch: "main",
});
// Returns: changed symbols + affected call chains + risk score
```

**Query the codebase like a database:**

```typescript
const routes = await codebase_memory["query_graph"]({
  project: "my-project",
  query:
    "MATCH (f:Function)-[:CALLS]->(g:Function) WHERE g.name CONTAINS 'Auth' RETURN f, g LIMIT 20",
});
```

### The 14 Graph Tools

| Tool               | Purpose                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `index_repository` | Index a repo into the knowledge graph                                |
| `index_status`     | Check indexing progress                                              |
| `get_architecture` | High-level overview: packages, hotspots, entry points                |
| `search_graph`     | BM25 + semantic + pattern search over the symbol graph               |
| `get_code_snippet` | Fetch source by qualified name — cheaper than grep for known symbols |
| `trace_path`       | BFS traversal: callers, callees, data flow, cross-service            |
| `query_graph`      | Cypher-subset queries for multi-hop relationship patterns            |
| `detect_changes`   | Git diff → affected symbols + impact/ blast-radius analysis            |
| `search_code`      | Graph-augmented grep: deduplicates matches into containing functions |
| `get_graph_schema` | Discover the graph schema before composing queries                   |
| `manage_adr`       | Architecture Decision Records stored in the graph                    |
| `ingest_traces`    | Runtime HTTP trace ingestion for call-path validation                |
| `list_projects`    | List indexed projects                                                |
| `delete_project`   | Remove a project from the graph                                      |

### vs. Serena

Both `serena` and `codebase-memory` navigate code. They do different things:

|               | Serena                         | codebase-memory                       |
| ------------- | ------------------------------ | ------------------------------------- |
| Approach      | LSP — asks the language server | Graph — pre-indexed knowledge graph   |
| Best for      | Find symbol, rename, refactor  | Multi-hop queries, impact analysis, ADRs |
| Startup       | Instant                        | Requires one-time indexing            |
| Cross-service | No                             | Yes                                   |

---

## Workspace Auto-Save

MCP tools return large payloads — web scrapes, research reports, generated content. Tool Executor intercepts responses over 200 characters and saves them to workspace automatically.

```typescript
const result = await apify["apify-slash-rag-web-browser"]({
  query: "MCP server patterns",
});

// Large response auto-saved — context untouched
// { _savedTo: "mcp-results/1705312345678.json", _preview: "...", _size: 15234 }

// Read inside execute_code when you need it
const full = await workspace.readJSON(result._savedTo);
```

> **Note:** Workspace files are not on the filesystem. Access them via `workspace.readJSON()` inside `execute_code`, not via the `Read` tool.

---

## When NOT to Use This

Tool Executor optimises for breadth across many servers. Skip it if:

- **You use 1-2 MCP servers** — the overhead isn't worth it; connect them directly
- **You need streaming** — the sandbox batches and returns once, no streaming
- **You're building production pipelines** — use the Anthropic SDK directly
- **You need sub-100ms latency** — sandbox startup adds overhead

---

## Skills & Commands

**Skills** (invoke from any Claude Code session):

- `/te-guide` — usage patterns and workflow examples
- `/te-config` — configuration help and custom server setup
- `/te-doctor` — diagnose connection issues with wrapped servers

**Commands**:

- `/tool-executor` — overview and quick reference

---

## Part of Claudikins

Tool Executor is the execution layer of the Claudikins framework — a set of Claude Code plugins designed to work together.

| Plugin                        | Purpose                                    |
| ----------------------------- | ------------------------------------------ |
| **Tool Executor**             | Programmatic MCP execution — you are here  |
| **Automatic Context Manager** | Seamless context handoff across sessions   |
| **Klaus**                     | Rigorous debugging with Germanic precision |
| **GRFP**                      | README generation through dual-AI research |

```bash
/marketplace add elb-pr/claudikins-marketplace
```

---

## License

[MIT](LICENSE) · Built by [Ethan Lee](https://github.com/elb-pr)
