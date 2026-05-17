#!/usr/bin/env node

import { Command } from "commander";
import { existsSync, readFileSync, statSync } from "fs";
import { resolve, dirname, isAbsolute, delimiter, join, extname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { getServerConfigs } from "./sandbox/clients.js";
import { loadConfig } from "./config.js";

const CLI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  readFileSync(resolve(CLI_ROOT, "package.json"), "utf-8"),
) as { version: string };

function hasExecutable(pathToCheck: string): boolean {
  try {
    return statSync(pathToCheck).isFile();
  } catch (_a) {
    return false;
  }
}

function isCommandAvailable(command: string): boolean {
  const commandHasExtension =
    process.platform === "win32" && Boolean(extname(command));
  const pathExtensions =
    process.platform === "win32" && !commandHasExtension
      ? (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";")
      : [""];
  const pathDirs = (process.env.PATH || "").split(delimiter);

  if (isAbsolute(command) || command.includes("/") || command.includes("\\")) {
    return hasExecutable(command);
  }

  for (const pathDir of pathDirs) {
    const cleanDir = pathDir.replace(/^["']|["']$/g, "");
    for (const ext of pathExtensions) {
      if (!cleanDir) {
        continue;
      }

      if (hasExecutable(join(cleanDir, `${command}${ext}`))) {
        return true;
      }
    }
  }

  return false;
}

function checkCommand(command: string, label: string, hint?: string): void {
  const found = isCommandAvailable(command);
  console.log(
    `${label}: ${found ? "✅ Found" : "⚠️ Not found"}${!found && hint ? ` (${hint})` : ""}`,
  );
}

function checkConfiguredServers(): void {
  for (const config of getServerConfigs()) {
    checkCommand(
      config.command,
      `${config.displayName} (${config.name}) command`,
      "Ensure executable is available in PATH or set an explicit absolute command in config",
    );
  }
}

function checkUvx(): void {
  checkCommand("uvx", "uvx", "optional, needed for Python MCP servers");
}

function checkConfig(): void {
  const result = loadConfig(undefined, { pluginDir: CLI_ROOT });
  const configs = getServerConfigs();
  const userCount = configs.filter(
    (c) => c.source && c.source !== "<default>",
  ).length;
  const defaultCount = configs.length - userCount;

  if (result && result.sources.length > 0) {
    console.log("Config sources (precedence low → high):");
    result.sources.forEach((path, i) => {
      console.log(`  ${i + 1}. ${path}`);
    });
  } else {
    console.log("Config sources: (none, using defaults)");
  }
  console.log(
    `Resolved ${configs.length} server(s) (${defaultCount} default + ${userCount} user)`,
  );
}

function checkRegistry(): boolean {
  return existsSync(resolve(CLI_ROOT, "registry"));
}

const program = new Command();

program
  .name("claudikins")
  .description("CLI for @claudikins/tool-executor")
  .version(packageJson.version);

program
  .command("doctor")
  .description("Check environment and dependencies")
  .action(async () => {
    console.log("🔍 Checking environment...\n");

    // Check Node version
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.slice(1).split(".")[0]);
    console.log(
      `Node.js: ${nodeVersion} ${nodeMajor >= 18 ? "✅" : "❌ (need 18+)"}`,
    );

    // Check for Python/uv (for uvx servers)
    checkUvx();

    // Check for config file
    checkConfig();

    // Check for registry
    const registryExists = checkRegistry();
    console.log(`Registry: ${registryExists ? "✅ Found" : "❌ Not found"}`);

    checkConfiguredServers();

    console.log("\n✨ Doctor complete");
  });

program
  .command("init")
  .description("Initialize a new tool-executor configuration")
  .action(async () => {
    const configPath = resolve(process.cwd(), "tool-executor.config.json");

    if (existsSync(configPath)) {
      console.log("⚠️ Config file already exists");
      return;
    }

    const { writeFileSync } = await import("fs");
    const defaultConfig = {
      servers: [
        {
          name: "example",
          displayName: "Example Server",
          command: "npx",
          args: ["-y", "example-mcp-server"],
        },
      ],
    };

    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log("✅ Created tool-executor.config.json");
    console.log(
      "   Edit this file to add your MCP servers, then run: claudikins extract",
    );
  });

program
  .command("extract")
  .description("Extract tool schemas from MCP servers into registry")
  .option("-a, --all", "Extract from all configured servers")
  .action(async (options: { all?: boolean }) => {
    if (!options.all) {
      console.log("Usage: claudikins extract --all");
      console.log("\nExtracts tool schemas from all configured MCP servers");
      console.log("and generates YAML files in the registry/ directory.");
      return;
    }

    console.log("🔧 Extracting schemas from MCP servers...\n");

    // Run the extract script via tsx
    const scriptPath = resolve(process.cwd(), "scripts/extract-schemas.ts");
    if (!existsSync(scriptPath)) {
      console.error(
        "❌ Extract script not found at scripts/extract-schemas.ts",
      );
      console.error(
        "   Make sure you're in the claudikins-tool-executor directory",
      );
      process.exit(1);
    }

    try {
      execSync(`npx tsx ${scriptPath}`, { stdio: "inherit" });
      console.log("\n✨ Extraction complete");
    } catch (error) {
      console.error("\n❌ Extraction failed");
      process.exit(1);
    }
  });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  program.parse();
}

export {
  hasExecutable,
  isCommandAvailable,
  checkCommand,
  checkConfiguredServers,
  checkUvx,
  checkConfig,
  checkRegistry,
  program,
  CLI_ROOT,
};
