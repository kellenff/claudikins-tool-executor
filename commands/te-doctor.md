---
name: claudikins-tool-executor:doctor
description: Diagnose Tool Executor issues - run tests, check health, troubleshoot
argument-hint: <mode: test|health|reset> [--verbose]
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Skill
skills:
  - te-doctor
---

# claudikins-tool-executor:doctor Command

You are orchestrating Tool Executor diagnostics with clear reporting at each step.

## Arguments

- `test` → Run syntax and registry checks and report results
- `health` → Check build status, registry integrity, workspace state
- `reset` → Guide through full reset (clean + reinstall + rebuild)
- `--verbose` → Show detailed output for any mode
- No argument → Run quick health check (syntax + registry checks)

## Workflow

1. Load the te-doctor skill for methodology
2. Run the requested diagnostic mode
3. Parse and present results clearly
4. Provide actionable next steps based on findings

## Health Check Items

| Check | Command | Expected |
|-------|---------|----------|
| Build current | `node --check dist/index.js dist/search.js dist/config.js dist/cli.js` | Exit 0 |
| Tests pass | Registry and runtime health checks | No parse/runtime check failures |
| Registry valid | Parse `registry/**/*.yaml` with `node --input-type=module` and `js-yaml` | YAML parses cleanly |
| Workspace clean | Check `./workspace/` | Exists, writable |

## Critical Facts

- **Tests are not pinned in this release** - use runtime syntax + registry checks as the baseline validation
- **Build command** - regenerate outputs with `npm run extract` then restart Claude Code
- **Serena health** - Two instances must be running for full functionality
