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
  },
  target: "node20",
  format: ["esm"],
  platform: "node",
  clean: true,
  dts: true,
  bundle: true,
  splitting: true,
  minify: true,
  sourcemap: true,
  treeshake: true,
});
