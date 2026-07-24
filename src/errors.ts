import { Data } from "effect";

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class McpClientError extends Data.TaggedError("McpClientError")<{
  readonly server: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class SearchError extends Data.TaggedError("SearchError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class WorkspaceError extends Data.TaggedError("WorkspaceError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class SandboxTimeout extends Data.TaggedError("SandboxTimeout")<{
  readonly timeoutMs: number;
}> {}

export class SandboxEvalError extends Data.TaggedError("SandboxEvalError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
