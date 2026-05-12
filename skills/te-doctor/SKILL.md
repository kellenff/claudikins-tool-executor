---
name: te-doctor
description: Use this skill when users say "tool executor not working", "diagnose tool executor", "check MCP health", "run tool executor tests", "debug search_tools", "execute_code failing", or need to troubleshoot issues with the Tool Executor.
---

# Tool Executor Diagnostics

Diagnose and fix issues with the Claudikins Tool Executor.

## Quick Health Check

Run focused checks that are available in this repo:

```bash
cd ${CLAUDE_PLUGIN_ROOT}
node --version
node --check dist/index.js dist/search.js dist/config.js dist/cli.js dist/sandbox/clients.js dist/sandbox/runtime.js
find registry -name "*.yaml" | wc -l
```

**Expected output:** no syntax errors, no parse failures, and expected registry count.

## Diagnostic Checklist

### 1. Build Status

Check the runtime JavaScript entrypoints:

```bash
cd ${CLAUDE_PLUGIN_ROOT}
node --check dist/index.js dist/search.js dist/config.js dist/cli.js dist/sandbox/clients.js dist/sandbox/runtime.js
```

**If build fails:**
- Run `npm install` to ensure dependencies are installed
- Check Node.js version (requires 18+)

### 2. MCP Server Connectivity

Test that MCP servers can connect. In execute_code:

```typescript
// Check which clients are available
console.log("Available:", Object.keys({ serena, gemini, context7 }));

// Test a simple call
try {
  const result = await serena.get_active_project({});
  console.log("Serena OK:", result ? "connected" : "no project");
} catch (e) {
  console.log("Serena error:", e.message);
}
```

**Common connectivity issues:**
- **uvx not installed**: Install with `pip install uvx` or `pipx install uvx`
- **npx timeout**: Network issues or npm registry problems
- **API key missing**: Check environment variables are set

### 3. Registry Integrity

Verify YAML files are valid:

```bash
cd ${CLAUDE_PLUGIN_ROOT}
# Count tool definitions
find registry -name "*.yaml" | wc -l
# Should be ~110 files

# Check for syntax errors
node --input-type=module -e 'import {globSync} from "glob"; import {readFileSync} from "node:fs"; import yaml from "js-yaml"; const files=globSync("registry/**/*.yaml"); for (const file of files) yaml.load(readFileSync(file, "utf-8")); console.log(`Parsed ${files.length} tools`);'
```

**If registry is corrupted:**
```bash
rm -rf registry/
npm run extract
```

### 4. Workspace State

Check workspace directory:

```bash
cd ${CLAUDE_PLUGIN_ROOT}
ls -la workspace/
du -sh workspace/  # Check disk usage
```

**Clean up old MCP results:**
```typescript
// In execute_code:
const deleted = await workspace.cleanupMcpResults(3600000); // 1 hour
console.log("Cleaned up", deleted, "old result files");
```

### 5. Serena Health (Critical)

Both Serena instances must be working:

**Registry Serena** (powers search_tools):
```bash
# Test semantic search
search_tools({ query: "diagram", limit: 3 })
# Should return gemini or shadcn tools
```

**Sandbox Serena** (available in execute_code):
```typescript
const symbols = await serena.find_symbol({ name_path: "workspace" });
console.log("Found symbols:", symbols.content?.length || 0);
```

**If Serena fails:**
- Check uvx is installed: `which uvx`
- Check Python 3.10+: `python3 --version`
- Try manual start: `uvx --from git+https://github.com/oraios/serena serena start-mcp-server`

## Common Issues

### Issue: "search_tools returns no results"

**Causes:**
1. Registry YAML files missing or corrupted
2. Serena not indexing registry directory
3. Query terms don't match any tool descriptions

**Fix:**
```bash
npm run extract   # Regenerate registry
# Restart Claude Code
```

### Issue: "execute_code times out"

**Causes:**
1. MCP server slow to connect (first use)
2. Long-running operation exceeds timeout
3. Infinite loop in code

**Fix:**
- Increase timeout: `execute_code({ code: "...", timeout: 60000 })`
- Split into smaller operations
- Check for infinite loops

### Issue: "MCP client returns null"

**Causes:**
1. Server failed to start
2. Environment variable missing
3. Package not found (npx/uvx issue)

**Fix:**
```bash
# Check environment variables
echo $GEMINI_API_KEY
echo $APIFY_TOKEN

# Test server manually
npx -y @rlabs-inc/gemini-mcp
```

### Issue: "Path traversal blocked"

**Cause:** Attempting to access files outside workspace.

**Fix:** All workspace paths must be relative and within `./workspace/`:
```typescript
// Wrong
await workspace.read("/etc/passwd");
await workspace.read("../package.json");

// Right
await workspace.read("data/file.txt");
```

### Issue: "Console output truncated"

**Cause:** Output exceeds 500 character limit.

**Fix:** Keep logs concise or save verbose output to workspace:
```typescript
// Instead of:
console.log(JSON.stringify(largeData, null, 2));

// Do:
await workspace.writeJSON("output.json", largeData);
console.log("Saved to output.json");
```

## Log Locations

**MCP Server Stderr:**
```bash
# Claude Code captures MCP stderr
# Check Claude Code's debug output
claude --debug
```

**Audit Log:**
```typescript
// In execute_code, MCP calls are logged
// Access via getAuditLog() in clients.ts (internal only)
```

## Test Coverage Notes

No fixed test corpus is guaranteed in this checkout. Use the runtime checks in this guide and `claude --debug` logs for validation.

## Nuclear Option: Full Reset

If nothing else works:

```bash
cd ${CLAUDE_PLUGIN_ROOT}

# Clean everything
rm -rf node_modules dist registry workspace/mcp-results

# Reinstall and rebuild
npm install
npm run extract

# Restart Claude Code
```

## Source Code Reference

- `${CLAUDE_PLUGIN_ROOT}/tests/` - All test files
- `${CLAUDE_PLUGIN_ROOT}/dist/sandbox/clients.js` - Client lifecycle
- `${CLAUDE_PLUGIN_ROOT}/dist/search.js` - Search implementation
- `${CLAUDE_PLUGIN_ROOT}/dist/sandbox/runtime.js` - Execution engine
