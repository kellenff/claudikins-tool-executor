import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  ServerConfigSchema,
  ToolExecutorConfigSchema,
  findConfigFiles,
  loadConfig,
} from "./config.js";

const SAVED_TEST_TOKEN_KEY = "TOOL_EXECUTOR_TEST_TOKEN";

function writeJson(path: string, body: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(body, null, 2));
}

describe("config", () => {
  let rootDir: string;
  const originalToken = process.env[SAVED_TEST_TOKEN_KEY];
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), "tool-executor-config-"));
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
    if (originalToken === undefined) {
      delete process.env[SAVED_TEST_TOKEN_KEY];
    } else {
      process.env[SAVED_TEST_TOKEN_KEY] = originalToken;
    }
    consoleErrorSpy.mockRestore();
  });

  describe("findConfigFiles", () => {
    it("returns an empty array when no layer exists", () => {
      const result = findConfigFiles({
        pluginDir: join(rootDir, "plugin"),
        cwd: join(rootDir, "cwd"),
        homedir: join(rootDir, "home"),
        xdgConfigHome: null,
        explicitPath: null,
      });
      expect(result).toEqual([]);
      // Absent layers must be silent (no warnings, no errors).
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("finds a plugin-layer config", () => {
      const pluginDir = join(rootDir, "plugin");
      writeJson(join(pluginDir, "tool-executor.config.json"), { servers: [] });

      const result = findConfigFiles({
        pluginDir,
        cwd: join(rootDir, "missing-cwd"),
        homedir: join(rootDir, "missing-home"),
        xdgConfigHome: null,
        explicitPath: null,
      });
      expect(result).toEqual([join(pluginDir, "tool-executor.config.json")]);
    });

    it("finds a cwd-layer config", () => {
      const cwd = join(rootDir, "project");
      writeJson(join(cwd, "tool-executor.config.json"), { servers: [] });

      const result = findConfigFiles({
        pluginDir: join(rootDir, "missing-plugin"),
        cwd,
        homedir: join(rootDir, "missing-home"),
        xdgConfigHome: null,
        explicitPath: null,
      });
      expect(result).toEqual([join(cwd, "tool-executor.config.json")]);
    });

    it("finds a ~/.claude-layer config", () => {
      const homedir = join(rootDir, "home");
      const claudePath = join(
        homedir,
        ".claude",
        "tool-executor",
        "tool-executor.config.json",
      );
      writeJson(claudePath, { servers: [] });

      const result = findConfigFiles({
        pluginDir: join(rootDir, "missing-plugin"),
        cwd: join(rootDir, "missing-cwd"),
        homedir,
        xdgConfigHome: null,
        explicitPath: null,
      });
      expect(result).toEqual([claudePath]);
    });

    it("finds an XDG-layer config when XDG_CONFIG_HOME is set", () => {
      const xdg = join(rootDir, "xdg");
      const xdgPath = join(xdg, "tool-executor", "tool-executor.config.json");
      writeJson(xdgPath, { servers: [] });

      const result = findConfigFiles({
        pluginDir: join(rootDir, "missing-plugin"),
        cwd: join(rootDir, "missing-cwd"),
        homedir: join(rootDir, "missing-home"),
        xdgConfigHome: xdg,
        explicitPath: null,
      });
      expect(result).toEqual([xdgPath]);
    });

    it("falls back to <homedir>/.config when XDG_CONFIG_HOME is unset", () => {
      const homedir = join(rootDir, "home");
      const fallbackPath = join(
        homedir,
        ".config",
        "tool-executor",
        "tool-executor.config.json",
      );
      writeJson(fallbackPath, { servers: [] });

      const result = findConfigFiles({
        pluginDir: join(rootDir, "missing-plugin"),
        cwd: join(rootDir, "missing-cwd"),
        homedir,
        xdgConfigHome: null,
        explicitPath: null,
      });
      expect(result).toEqual([fallbackPath]);
    });

    it("treats empty/whitespace XDG_CONFIG_HOME as unset", () => {
      const homedir = join(rootDir, "home");
      const fallbackPath = join(
        homedir,
        ".config",
        "tool-executor",
        "tool-executor.config.json",
      );
      writeJson(fallbackPath, { servers: [] });

      const result = findConfigFiles({
        pluginDir: join(rootDir, "missing-plugin"),
        cwd: join(rootDir, "missing-cwd"),
        homedir,
        xdgConfigHome: "   ",
        explicitPath: null,
      });
      expect(result).toEqual([fallbackPath]);
    });

    it("finds an explicit-path config and treats the path literally", () => {
      const explicitPath = join(rootDir, "custom-place", "my.config.json");
      writeJson(explicitPath, { servers: [] });

      const result = findConfigFiles({
        pluginDir: join(rootDir, "missing-plugin"),
        cwd: join(rootDir, "missing-cwd"),
        homedir: join(rootDir, "missing-home"),
        xdgConfigHome: null,
        explicitPath,
      });
      expect(result).toEqual([explicitPath]);
    });

    it("warns when explicitPath is set but missing; still returns []", () => {
      const explicitPath = join(rootDir, "nope.json");

      const result = findConfigFiles({
        pluginDir: join(rootDir, "missing-plugin"),
        cwd: join(rootDir, "missing-cwd"),
        homedir: join(rootDir, "missing-home"),
        xdgConfigHome: null,
        explicitPath,
      });
      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("TOOL_EXECUTOR_CONFIG points to missing file"),
      );
    });

    it("does not expand ${VAR} in the explicit path itself (paths are literal)", () => {
      process.env[SAVED_TEST_TOKEN_KEY] = "real-dir";
      const literal = join(rootDir, "${TOOL_EXECUTOR_TEST_TOKEN}", "x.json");

      const result = findConfigFiles({
        pluginDir: join(rootDir, "missing-plugin"),
        cwd: join(rootDir, "missing-cwd"),
        homedir: join(rootDir, "missing-home"),
        xdgConfigHome: null,
        explicitPath: literal,
      });
      expect(result).toEqual([]);
      // It should look for the literal `${TOOL_EXECUTOR_TEST_TOKEN}` directory, not `real-dir`.
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("${TOOL_EXECUTOR_TEST_TOKEN}"),
      );
    });

    it("returns all matching layers in precedence order (lowest → highest)", () => {
      const pluginDir = join(rootDir, "plugin");
      const cwd = join(rootDir, "project");
      const homedir = join(rootDir, "home");
      const xdg = join(rootDir, "xdg");
      const explicitPath = join(rootDir, "explicit.json");

      const pluginPath = join(pluginDir, "tool-executor.config.json");
      const cwdPath = join(cwd, "tool-executor.config.json");
      const claudePath = join(
        homedir,
        ".claude",
        "tool-executor",
        "tool-executor.config.json",
      );
      const xdgPath = join(xdg, "tool-executor", "tool-executor.config.json");

      writeJson(pluginPath, { servers: [] });
      writeJson(cwdPath, { servers: [] });
      writeJson(claudePath, { servers: [] });
      writeJson(xdgPath, { servers: [] });
      writeJson(explicitPath, { servers: [] });

      const result = findConfigFiles({
        pluginDir,
        cwd,
        homedir,
        xdgConfigHome: xdg,
        explicitPath,
      });
      expect(result).toEqual([
        pluginPath,
        cwdPath,
        claudePath,
        xdgPath,
        explicitPath,
      ]);
    });

    it("deduplicates layers that resolve to the same absolute path", () => {
      const shared = join(rootDir, "shared");
      writeJson(join(shared, "tool-executor.config.json"), { servers: [] });

      // cwd === pluginDir, both pointing at the same file.
      const result = findConfigFiles({
        pluginDir: shared,
        cwd: shared,
        homedir: join(rootDir, "missing-home"),
        xdgConfigHome: null,
        explicitPath: null,
      });
      expect(result).toEqual([join(shared, "tool-executor.config.json")]);
    });
  });

  describe("loadConfig — single path mode", () => {
    it("returns null when the explicit path does not exist", () => {
      expect(loadConfig(join(rootDir, "missing.config.json"))).toBeNull();
    });

    it("loads config and expands environment variables inside values", () => {
      process.env[SAVED_TEST_TOKEN_KEY] = "secret";
      const configPath = join(rootDir, "tool-executor.config.json");
      writeJson(configPath, {
        servers: [
          {
            name: "test",
            displayName: "Test",
            command: "npx",
            args: ["echo", "${TOOL_EXECUTOR_TEST_TOKEN}"],
            env: {
              TOKEN: "${TOOL_EXECUTOR_TEST_TOKEN}",
            },
          },
        ],
      });

      const config = loadConfig(configPath);

      expect(config).toEqual({
        servers: [
          {
            name: "test",
            displayName: "Test",
            command: "npx",
            args: ["echo", "secret"],
            env: { TOKEN: "secret" },
            source: resolve(configPath),
          },
        ],
        sources: [resolve(configPath)],
      });
    });

    it("returns null when schema validation fails (loud)", () => {
      const configPath = join(rootDir, "tool-executor.config.json");
      writeJson(configPath, {
        servers: [
          {
            name: "",
            displayName: "NoName",
            command: "npx",
            args: ["echo"],
          },
        ],
      });

      expect(loadConfig(configPath)).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load config from"),
        expect.anything(),
      );
    });

    it("returns null when JSON cannot be parsed (loud)", () => {
      const configPath = join(rootDir, "tool-executor.config.json");
      writeFileSync(configPath, "{ invalid }");

      expect(loadConfig(configPath)).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load config from"),
        expect.anything(),
      );
    });

    it("accepts empty servers: []", () => {
      const configPath = join(rootDir, "tool-executor.config.json");
      writeJson(configPath, { servers: [] });

      const config = loadConfig(configPath);
      expect(config).toEqual({
        servers: [],
        sources: [resolve(configPath)],
      });
    });

    it("accepts user-supplied commandEnvKey", () => {
      const configPath = join(rootDir, "tool-executor.config.json");
      writeJson(configPath, {
        servers: [
          {
            name: "custom",
            displayName: "Custom",
            command: "fallback-bin",
            commandEnvKey: "CUSTOM_BIN",
            trusted: true,
            args: [],
          },
        ],
      });

      const config = loadConfig(configPath);
      expect(config?.servers[0]).toMatchObject({
        name: "custom",
        command: "fallback-bin",
        commandEnvKey: "CUSTOM_BIN",
        trusted: true,
      });
    });
  });

  describe("loadConfig — layered mode", () => {
    function layout() {
      const pluginDir = join(rootDir, "plugin");
      const cwd = join(rootDir, "project");
      const homedir = join(rootDir, "home");
      const xdg = join(rootDir, "xdg");
      return {
        pluginDir,
        cwd,
        homedir,
        xdg,
        pluginPath: join(pluginDir, "tool-executor.config.json"),
        cwdPath: join(cwd, "tool-executor.config.json"),
        claudePath: join(
          homedir,
          ".claude",
          "tool-executor",
          "tool-executor.config.json",
        ),
        xdgPath: join(xdg, "tool-executor", "tool-executor.config.json"),
      };
    }

    it("merges two layers, later layer wins by name, sources in precedence order", () => {
      const l = layout();
      writeJson(l.claudePath, {
        servers: [
          {
            name: "shared",
            displayName: "From ~/.claude",
            command: "from-home",
            args: ["a"],
          },
          {
            name: "only-home",
            displayName: "Home only",
            command: "x",
            args: [],
          },
        ],
      });
      writeJson(l.cwdPath, {
        servers: [
          {
            name: "shared",
            displayName: "From cwd",
            command: "from-cwd",
            args: ["b"],
          },
        ],
      });

      const result = loadConfig(undefined, {
        pluginDir: join(rootDir, "missing-plugin"),
        cwd: l.cwd,
        homedir: l.homedir,
        xdgConfigHome: null,
        explicitPath: null,
      });

      expect(result?.sources).toEqual([l.cwdPath, l.claudePath]);
      // `shared` from ~/.claude beats cwd because ~/.claude is higher precedence.
      const shared = result?.servers.find((s) => s.name === "shared");
      expect(shared?.command).toBe("from-home");
      expect(shared?.source).toBe(l.claudePath);
      // `only-home` carried through.
      const onlyHome = result?.servers.find((s) => s.name === "only-home");
      expect(onlyHome?.source).toBe(l.claudePath);
    });

    it("merges three layers and asserts the full precedence order", () => {
      const l = layout();
      const explicitPath = join(rootDir, "explicit.json");
      writeJson(l.cwdPath, {
        servers: [
          {
            name: "a",
            displayName: "From cwd",
            command: "cwd-cmd",
            args: [],
          },
        ],
      });
      writeJson(l.claudePath, {
        servers: [
          {
            name: "a",
            displayName: "From ~/.claude",
            command: "claude-cmd",
            args: [],
          },
          {
            name: "b",
            displayName: "From ~/.claude",
            command: "b-cmd",
            args: [],
          },
        ],
      });
      writeJson(explicitPath, {
        servers: [
          {
            name: "a",
            displayName: "From explicit",
            command: "explicit-cmd",
            args: [],
          },
        ],
      });

      const result = loadConfig(undefined, {
        pluginDir: join(rootDir, "missing-plugin"),
        cwd: l.cwd,
        homedir: l.homedir,
        xdgConfigHome: null,
        explicitPath,
      });

      expect(result?.sources).toEqual([l.cwdPath, l.claudePath, explicitPath]);
      const a = result?.servers.find((s) => s.name === "a");
      expect(a?.command).toBe("explicit-cmd");
      expect(a?.source).toBe(explicitPath);
      const b = result?.servers.find((s) => s.name === "b");
      expect(b?.source).toBe(l.claudePath);
    });

    it("skips a malformed layer and continues with the rest (loud)", () => {
      const l = layout();
      mkdirSync(dirname(l.cwdPath), { recursive: true });
      writeFileSync(l.cwdPath, "{ not valid json");
      writeJson(l.claudePath, {
        servers: [
          {
            name: "good",
            displayName: "good",
            command: "ok",
            args: [],
          },
        ],
      });

      const result = loadConfig(undefined, {
        pluginDir: join(rootDir, "missing-plugin"),
        cwd: l.cwd,
        homedir: l.homedir,
        xdgConfigHome: null,
        explicitPath: null,
      });
      expect(result?.sources).toEqual([l.claudePath]);
      expect(result?.servers.map((s) => s.name)).toEqual(["good"]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load config from"),
        expect.anything(),
      );
    });

    it("returns null when every layer is missing (silent)", () => {
      const result = loadConfig(undefined, {
        pluginDir: join(rootDir, "missing-plugin"),
        cwd: join(rootDir, "missing-cwd"),
        homedir: join(rootDir, "missing-home"),
        xdgConfigHome: null,
        explicitPath: null,
      });
      expect(result).toBeNull();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("returns null when every found layer is malformed", () => {
      const l = layout();
      writeFileSync(
        (() => {
          mkdirSync(dirname(l.cwdPath), { recursive: true });
          return l.cwdPath;
        })(),
        "{ not json",
      );

      const result = loadConfig(undefined, {
        pluginDir: join(rootDir, "missing-plugin"),
        cwd: l.cwd,
        homedir: join(rootDir, "missing-home"),
        xdgConfigHome: null,
        explicitPath: null,
      });
      expect(result).toBeNull();
    });

    it("expands ${VAR} in every layer's values", () => {
      process.env[SAVED_TEST_TOKEN_KEY] = "from-env";
      const l = layout();
      writeJson(l.cwdPath, {
        servers: [
          {
            name: "a",
            displayName: "A",
            command: "cmd",
            args: ["${TOOL_EXECUTOR_TEST_TOKEN}"],
          },
        ],
      });
      writeJson(l.claudePath, {
        servers: [
          {
            name: "b",
            displayName: "B",
            command: "cmd",
            args: [],
            env: { X: "${TOOL_EXECUTOR_TEST_TOKEN}" },
          },
        ],
      });

      const result = loadConfig(undefined, {
        pluginDir: join(rootDir, "missing-plugin"),
        cwd: l.cwd,
        homedir: l.homedir,
        xdgConfigHome: null,
        explicitPath: null,
      });
      const a = result?.servers.find((s) => s.name === "a");
      const b = result?.servers.find((s) => s.name === "b");
      expect(a?.args).toEqual(["from-env"]);
      expect(b?.env).toEqual({ X: "from-env" });
    });
  });

  describe("schemas", () => {
    it("ServerConfigSchema accepts canonical and optional fields", () => {
      const server = {
        name: "server-name",
        displayName: "Server Name",
        command: "node",
        commandEnvKey: "SERVER_BIN",
        trusted: true,
        args: ["server.js"],
        env: { TOKEN: "secret" },
      };

      expect(ServerConfigSchema.parse(server)).toEqual(server);
      expect(() => ServerConfigSchema.parse({ ...server, name: "" })).toThrow();
      expect(() =>
        ServerConfigSchema.parse({ ...server, displayName: "" }),
      ).toThrow();
      expect(() =>
        ServerConfigSchema.parse({ ...server, command: "" }),
      ).toThrow();
      expect(() =>
        ServerConfigSchema.parse({ ...server, args: [1] }),
      ).toThrow();
      // ServerConfigSchema is not strict — extra fields are stripped, not rejected.
      expect(() =>
        ServerConfigSchema.parse({ ...server, extra: true }),
      ).not.toThrow();
    });

    it("ToolExecutorConfigSchema is strict and accepts empty servers", () => {
      const server = {
        name: "server-name",
        displayName: "Server Name",
        command: "node",
        trusted: true,
        args: ["server.js"],
        env: { TOKEN: "secret" },
      };

      expect(
        ToolExecutorConfigSchema.parse({
          $schema: "https://example.test/schema.json",
          servers: [server],
        }),
      ).toEqual({
        $schema: "https://example.test/schema.json",
        servers: [server],
      });
      // Empty servers list is legal.
      expect(() =>
        ToolExecutorConfigSchema.parse({ servers: [] }),
      ).not.toThrow();
      // Extra top-level keys still rejected.
      expect(() =>
        ToolExecutorConfigSchema.parse({ servers: [server], extra: true }),
      ).toThrow();
    });
  });
});
