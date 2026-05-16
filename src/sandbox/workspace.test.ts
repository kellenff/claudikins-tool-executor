import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  existsSync,
  mkdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { MCP_RESULTS_DIR } from "../constants.js";
import { workspace } from "./workspace.js";

describe("workspace", () => {
  const prefix = "__tool_executor_unit__";
  const workspaceDir = join(process.cwd(), "workspace");
  const fixtureRoot = join(prefix, "fixture");

  beforeEach(async () => {
    await workspace.mkdir(fixtureRoot);
  });

  afterEach(() => {
    rmSync(join(workspaceDir, prefix), { recursive: true, force: true });
  });

  it("allows safe write/read/append operations", async () => {
    await workspace.write(`${fixtureRoot}/notes.txt`, "start");
    expect(await workspace.read(`${fixtureRoot}/notes.txt`)).toBe("start");
    await workspace.append(`${fixtureRoot}/notes.txt`, "\nextra");
    expect(await workspace.read(`${fixtureRoot}/notes.txt`)).toBe(
      "start\nextra",
    );
  });

  it("supports JSON and binary helpers", async () => {
    const jsonPath = `${fixtureRoot}/payload.json`;
    await workspace.writeJSON(jsonPath, { value: 42 });
    const parsed = await workspace.readJSON(jsonPath);
    expect(parsed).toEqual({ value: 42 });

    const bufferPath = `${fixtureRoot}/data.bin`;
    const data = Buffer.from(new TextEncoder().encode("bytes"));
    await workspace.writeBuffer(bufferPath, data);
    const out = await workspace.readBuffer(bufferPath);
    expect(Buffer.from(out).toString("utf8")).toBe("bytes");
  });

  it("lists and cleans directories", async () => {
    await workspace.mkdir(`${fixtureRoot}/nested`);
    await workspace.write(`${fixtureRoot}/nested/file.txt`, "one");

    const entries = await workspace.list(fixtureRoot);
    expect(entries).toContain("nested");
    expect(await workspace.exists(`${fixtureRoot}/nested/file.txt`)).toBe(true);

    const stat = await workspace.stat(`${fixtureRoot}/nested/file.txt`);
    expect(stat.isDir).toBe(false);
    expect(stat.size).toBeGreaterThan(0);

    await workspace.delete(`${fixtureRoot}/nested/file.txt`);
    expect(await workspace.exists(`${fixtureRoot}/nested/file.txt`)).toBe(
      false,
    );
  });

  it("guards path traversal attempts", async () => {
    await expect(workspace.read("../package.json")).rejects.toThrow(
      "Path traversal blocked",
    );
    await expect(workspace.write("/etc/hosts", "x")).rejects.toThrow(
      "Path traversal blocked",
    );
    await expect(workspace.glob("../**/*.txt")).rejects.toThrow(
      "Glob traversal blocked",
    );
  });

  it("runs glob on safe patterns", async () => {
    await workspace.write(`${fixtureRoot}/match.txt`, "yes");
    await workspace.write(`${fixtureRoot}/other.txt`, "no");

    const matches = await workspace.glob(`${fixtureRoot}/*.txt`);
    expect(matches).toContain(`${fixtureRoot}/match.txt`);
    expect(matches).toContain(`${fixtureRoot}/other.txt`);
  });

  it("cleans up old MCP result files", async () => {
    const resultsDir = join(workspaceDir, MCP_RESULTS_DIR);
    mkdirSync(resultsDir, { recursive: true });
    const oldFile = join(resultsDir, "old.json");
    const freshFile = join(resultsDir, "fresh.json");
    writeFileSync(oldFile, "{}");
    writeFileSync(freshFile, "{}");
    const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
    utimesSync(oldFile, oldDate, oldDate);

    await expect(workspace.cleanupMcpResults()).resolves.toBe(1);

    expect(existsSync(oldFile)).toBe(false);
    expect(existsSync(freshFile)).toBe(true);
    rmSync(resultsDir, { recursive: true, force: true });
    await expect(workspace.cleanupMcpResults()).resolves.toBe(0);
  });
});
