import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    index: "src/index.ts",
    config: "src/config.ts",
    search: "src/search.ts",
    types: "src/types.ts",
    "sandbox/clients": "src/sandbox/clients.ts",
    "sandbox/runtime": "src/sandbox/runtime.ts",
    "sandbox/workspace": "src/sandbox/workspace.ts",
    "tools/execute": "src/tools/execute.ts",
    "tools/schema": "src/tools/schema.ts",
    "tools/search": "src/tools/search.ts",
    "scripts/extract-schemas": "scripts/extract-schemas.ts",
    "scripts/test-connection": "scripts/test-connection.ts",
  },
  target: "node20",
  format: ["esm"],
  platform: "node",
  clean: true,
  dts: true,
  bundle: true,
  // ponytail: bundled CJS deps emit `require('child_process')` calls; ESM has
  // no `require`. Inject a createRequire shim via banner so the bundled chunks
  // can run as ESM. Without this, the startup error is "Dynamic require of
  // 'child_process' is not supported".
  banner: {
    js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);",
  },
  // ponytail: plugin caches ship without node_modules. Bundle the runtime deps
  // so the cache is self-contained — `noExternal: [/.*/]` was tried first but
  // it forces Node builtins (e.g. child_process) into a CJS `require()` call,
  // which pure ESM can't honour. Surgical list keeps builtins external.
  noExternal: [
    "@modelcontextprotocol/sdk",
    "commander",
    "dotenv",
    "effect",
    "glob",
    "js-yaml",
    "wink-bm25-text-search",
    "wink-nlp-utils",
    "zod",
  ],
  splitting: true,
  minify: true,
  sourcemap: true,
  treeshake: true,
});
