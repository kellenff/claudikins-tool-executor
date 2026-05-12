import { afterEach, describe, expect, it, vi } from "vitest";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("./config.js", () => ({
  findConfigFile: vi.fn(),
}));

vi.mock("./sandbox/clients.js", () => ({
  getServerConfigs: vi.fn(),
}));

import * as cli from "./cli.js";
import * as config from "./config.js";
import * as clients from "./sandbox/clients.js";

describe("cli helpers", () => {
  const originalPath = process.env.PATH;

  afterEach(() => {
    process.env.PATH = originalPath;
    vi.restoreAllMocks();
  });

  it("checks command availability via PATH lookup", () => {
    expect(cli.isCommandAvailable("node")).toBe(true);
    expect(cli.isCommandAvailable("does-not-exist")).toBe(false);
  });

  it("checks command availability for explicit paths and quoted PATH entries", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "tool-executor-cli-"));
    const commandPath = join(rootDir, "probe");
    writeFileSync(commandPath, "#!/bin/sh\n");
    chmodSync(commandPath, 0o755);

    process.env.PATH = `"${rootDir}"`;

    expect(cli.isCommandAvailable(commandPath)).toBe(true);
    expect(cli.isCommandAvailable("probe")).toBe(true);
    expect(cli.isCommandAvailable(join(rootDir, "missing"))).toBe(false);
    expect(cli.isCommandAvailable("")).toBe(false);

    rmSync(rootDir, { recursive: true, force: true });
  });

  it("prints check status with hint text", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(cli, "isCommandAvailable").mockReturnValue(true);

    cli.checkCommand("node", "Node runtime");

    expect(consoleSpy).toHaveBeenCalledWith("Node runtime: ✅ Found");
  });

  it("reports missing command with hint", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(cli, "isCommandAvailable").mockReturnValue(false);

    cli.checkCommand("missing", "Missing binary", "Run installer");

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Missing binary: ⚠️ Not found (Run installer)"));
  });

  it("checks config detection result", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(config, "findConfigFile").mockReturnValue("/tmp/tool-executor.config.json");

    cli.checkConfig();
    expect(consoleSpy).toHaveBeenCalledWith("Config file: ✅ Found");
    expect(consoleSpy).toHaveBeenCalledWith("  - /tmp/tool-executor.config.json");
  });

  it("checks missing config detection result", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(config, "findConfigFile").mockReturnValue(null);

    cli.checkConfig();

    expect(consoleSpy).toHaveBeenCalledWith("Config file: ⚠️ Not found (using defaults)");
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

  it("checks configured servers using mocked server list", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(clients, "getServerConfigs").mockReturnValue([
      { name: "probe", displayName: "Probe Server", command: "node", args: [] },
    ]);

    cli.checkConfiguredServers();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Probe Server (probe) command: ✅ Found"));
  });

  it("checks registry directory presence", () => {
    expect(cli.checkRegistry()).toBe(true);
  });

  it("runs the doctor command", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(config, "findConfigFile").mockReturnValue(null);
    vi.spyOn(clients, "getServerConfigs").mockReturnValue([
      { name: "probe", displayName: "Probe Server", command: "node", args: [] },
    ]);

    await cli.program.parseAsync(["node", "claudikins", "doctor"]);

    expect(consoleSpy).toHaveBeenCalledWith("🔍 Checking environment...\n");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Node.js:"));
    expect(consoleSpy).toHaveBeenCalledWith("Config file: ⚠️ Not found (using defaults)");
    expect(consoleSpy).toHaveBeenCalledWith("Registry: ✅ Found");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Probe Server (probe) command: ✅ Found"));
    expect(consoleSpy).toHaveBeenCalledWith("\n✨ Doctor complete");
  });

  it("runs init command without overwriting an existing config", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "tool-executor-init-"));
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "cwd").mockReturnValue(rootDir);

    await cli.program.parseAsync(["node", "claudikins", "init"]);

    const configPath = join(rootDir, "tool-executor.config.json");
    expect(existsSync(configPath)).toBe(true);
    expect(JSON.parse(readFileSync(configPath, "utf-8"))).toMatchObject({
      servers: [
        {
          name: "example",
          displayName: "Example Server",
          command: "npx",
          args: ["-y", "example-mcp-server"],
        },
      ],
    });
    expect(consoleSpy).toHaveBeenCalledWith("✅ Created tool-executor.config.json");

    await cli.program.parseAsync(["node", "claudikins", "init"]);
    expect(consoleSpy).toHaveBeenCalledWith("⚠️ Config file already exists");

    rmSync(rootDir, { recursive: true, force: true });
  });

  it("prints extract usage when --all is omitted", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await cli.program.parseAsync(["node", "claudikins", "extract"]);

    expect(consoleSpy).toHaveBeenCalledWith("Usage: claudikins extract --all");
    expect(consoleSpy).toHaveBeenCalledWith("\nExtracts tool schemas from all configured MCP servers");
    expect(consoleSpy).toHaveBeenCalledWith("and generates YAML files in the registry/ directory.");
  });

  it("reports missing extract script when --all is requested outside the project", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "tool-executor-extract-"));
    vi.spyOn(process, "cwd").mockReturnValue(rootDir);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(process, "exit").mockImplementation((code?: string | number | null) => {
      throw new Error(`exit ${code}`);
    });

    await expect(cli.program.parseAsync(["node", "claudikins", "extract", "--all"])).rejects.toThrow("exit 1");

    expect(consoleErrorSpy).toHaveBeenCalledWith("❌ Extract script not found at scripts/extract-schemas.ts");
    expect(consoleErrorSpy).toHaveBeenCalledWith("   Make sure you're in the claudikins-tool-executor directory");
    rmSync(rootDir, { recursive: true, force: true });
  });
});
