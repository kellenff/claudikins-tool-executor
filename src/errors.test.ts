import { describe, expect, it } from "vitest";
import {
  ConfigError,
  McpClientError,
  SandboxEvalError,
  SearchError,
  WorkspaceError,
} from "./errors.js";

describe("errors", () => {
  it("exposes _tag discriminants", () => {
    expect(new ConfigError({ message: "x" })._tag).toBe("ConfigError");
    expect(new McpClientError({ server: "s", message: "m" })._tag).toBe("McpClientError");
    expect(new SearchError({ message: "s" })._tag).toBe("SearchError");
    expect(new WorkspaceError({ message: "w" })._tag).toBe("WorkspaceError");
    expect(new SandboxEvalError({ message: "e" })._tag).toBe("SandboxEvalError");
  });
});
