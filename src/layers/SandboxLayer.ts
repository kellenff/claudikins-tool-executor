import { Effect, Layer } from "effect";

import {
  cleanupIdleClients,
  disconnectAll as disconnectAllClients,
  disconnectClient as disconnectOneClient,
  getAvailableClients,
  getConnectedClients,
  getClient as getMcpClient,
  startLifecycleManagement,
} from "../sandbox/clients.js";
import { workspace } from "../sandbox/workspace.js";
import { WorkspaceError } from "../errors.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { Clients, Workspace } from "./services.js";

/** Wrap a workspace call, mapping path/glob traversal errors to WorkspaceError. */
const toWorkspaceError = (cause: unknown): WorkspaceError => {
  const message = cause instanceof Error ? cause.message : String(cause);
  return new WorkspaceError({ message, cause });
};

const workspaceService = {
  read: (path: string) =>
    Effect.tryPromise({
      try: () => workspace.read(path),
      catch: toWorkspaceError,
    }),
  write: (path: string, data: string) =>
    Effect.tryPromise({
      try: () => workspace.write(path, data),
      catch: toWorkspaceError,
    }),
  append: (path: string, data: string) =>
    Effect.tryPromise({
      try: () => workspace.append(path, data),
      catch: toWorkspaceError,
    }),
  delete: (path: string) =>
    Effect.tryPromise({
      try: () => workspace.delete(path),
      catch: toWorkspaceError,
    }),
  readJSON: <T = unknown>(path: string) =>
    Effect.tryPromise({
      try: () => workspace.readJSON<T>(path),
      catch: toWorkspaceError,
    }),
  writeJSON: (path: string, data: unknown) =>
    Effect.tryPromise({
      try: () => workspace.writeJSON(path, data),
      catch: toWorkspaceError,
    }),
  readBuffer: (path: string) =>
    Effect.tryPromise({
      try: () => workspace.readBuffer(path),
      catch: toWorkspaceError,
    }),
  writeBuffer: (path: string, data: Buffer) =>
    Effect.tryPromise({
      try: () => workspace.writeBuffer(path, data),
      catch: toWorkspaceError,
    }),
  list: (path?: string) =>
    Effect.tryPromise({
      try: () => workspace.list(path),
      catch: toWorkspaceError,
    }),
  glob: (pattern: string) =>
    Effect.tryPromise({
      try: () => workspace.glob(pattern),
      catch: toWorkspaceError,
    }),
  exists: (path: string) =>
    Effect.tryPromise({
      try: () => workspace.exists(path),
      catch: toWorkspaceError,
    }),
  stat: (path: string) =>
    Effect.tryPromise({
      try: () => workspace.stat(path),
      catch: toWorkspaceError,
    }),
  cleanupMcpResults: () =>
    Effect.tryPromise({
      try: () => workspace.cleanupMcpResults(),
      catch: () => 0,
    }).pipe(Effect.orElseSucceed(() => 0)),
};

export const WorkspaceLive: Layer.Layer<Workspace> = Layer.succeed(Workspace, workspaceService);

/**
 * Clients lifecycle: Layer.effect wraps construction in a Scope so the finalizer runs when the
 * runtime is disposed. startLifecycleManagement is idempotent, so duplicate startup is safe.
 */
export const ClientsLive: Layer.Layer<Clients, never, never> = Layer.effect(
  Clients,
  Effect.gen(function* () {
    yield* Effect.sync(() => startLifecycleManagement());

    yield* Effect.addFinalizer(() =>
      Effect.tryPromise({
        try: () => disconnectAllClients(),
        catch: () => undefined,
      }).pipe(Effect.orElseSucceed(() => undefined)),
    );

    return {
      getClient: (name: string) =>
        Effect.tryPromise({
          try: () => getMcpClient(name),
          catch: () => null,
        }).pipe(Effect.orElseSucceed(() => null as Client | null)),
      disconnectClient: (name: string) =>
        Effect.tryPromise({
          try: () => disconnectOneClient(name),
          catch: () => undefined,
        }).pipe(Effect.orElseSucceed(() => undefined)),
      disconnectAll: () =>
        Effect.tryPromise({
          try: () => disconnectAllClients(),
          catch: () => undefined,
        }).pipe(Effect.orElseSucceed(() => undefined)),
      cleanupIdle: () =>
        Effect.tryPromise({
          try: () => cleanupIdleClients(),
          catch: () => undefined,
        }).pipe(Effect.orElseSucceed(() => undefined)),
      availableNames: () => Effect.sync(() => getAvailableClients()),
      connectedNames: () => Effect.sync(() => getConnectedClients()),
    };
  }),
);
