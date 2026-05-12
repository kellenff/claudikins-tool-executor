import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ServerConfigSchema,
  ToolExecutorConfigSchema,
  findConfigFile,
  loadConfig,
} from "./config.js";

describe("config", () => {
  let rootDir: string;
  const originalToken = process.env.TOOL_EXECUTOR_TEST_TOKEN;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), "tool-executor-config-"));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
    if (originalToken === undefined) {
      delete process.env.TOOL_EXECUTOR_TEST_TOKEN;
    } else {
      process.env.TOOL_EXECUTOR_TEST_TOKEN = originalToken;
    }
  });

  it("finds the first supported config filename in order", () => {
    const jsonPath = join(rootDir, "tool-executor.config.json");
    const jsPath = join(rootDir, "tool-executor.config.js");
    writeFileSync(jsPath, "{}");
    writeFileSync(jsonPath, "{}");

    expect(findConfigFile(rootDir)).toBe(jsonPath);
  });

  it("returns null when no config file exists", () => {
    expect(findConfigFile(rootDir)).toBeNull();
    expect(loadConfig(join(rootDir, "missing.config.json"))).toBeNull();
  });

  it("loads config and expands environment variables", () => {
    process.env.TOOL_EXECUTOR_TEST_TOKEN = "secret";
    const configPath = join(rootDir, "tool-executor.config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
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
      }, null, 2),
    );

    const config = loadConfig(configPath);

    expect(config).toEqual({
      servers: [
        {
          name: "test",
          displayName: "Test",
          command: "npx",
          args: ["echo", "secret"],
          env: {
            TOKEN: "secret",
          },
        },
      ],
    });
  });

  it("returns null when schema validation fails", () => {
    const configPath = join(rootDir, "tool-executor.config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        servers: [
          {
            name: "",
            displayName: "NoName",
            command: "npx",
            args: ["echo"],
          },
        ],
      }),
    );

    expect(loadConfig(configPath)).toBeNull();
  });

  it("returns null when JSON cannot be parsed", () => {
    const configPath = join(rootDir, "tool-executor.config.json");
    writeFileSync(configPath, "{ invalid }");

    expect(loadConfig(configPath)).toBeNull();
  });

  it("exposes strict config schemas", () => {
    const server = {
      name: "server-name",
      displayName: "Server Name",
      command: "node",
      trusted: true,
      args: ["server.js"],
      env: { TOKEN: "secret" },
    };

    expect(ServerConfigSchema.parse(server)).toEqual(server);
    expect(() => ServerConfigSchema.parse({ ...server, name: "" })).toThrow();
    expect(() => ServerConfigSchema.parse({ ...server, displayName: "" })).toThrow();
    expect(() => ServerConfigSchema.parse({ ...server, command: "" })).toThrow();
    expect(() => ServerConfigSchema.parse({ ...server, args: [1] })).toThrow();
    expect(() => ServerConfigSchema.parse({ ...server, extra: true })).not.toThrow();

    expect(ToolExecutorConfigSchema.parse({
      $schema: "https://example.test/schema.json",
      servers: [server],
    })).toEqual({
      $schema: "https://example.test/schema.json",
      servers: [server],
    });
    expect(() => ToolExecutorConfigSchema.parse({ servers: [] })).toThrow();
    expect(() => ToolExecutorConfigSchema.parse({ servers: [server], extra: true })).toThrow();
  });
});
