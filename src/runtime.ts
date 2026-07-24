import { ManagedRuntime } from "effect";
import type { Layer } from "effect";

import { AppLive } from "./layers/AppLive.js";

export type AppRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Success<typeof AppLive>,
  Layer.Error<typeof AppLive>
>;

export function makeAppRuntime(): AppRuntime {
  return ManagedRuntime.make(AppLive);
}

/** Process-wide runtime for tool handlers. Lazy singleton — first use builds it. */
let runtimeSingleton: AppRuntime | undefined;

export function getAppRuntime(): AppRuntime {
  if (!runtimeSingleton) {
    runtimeSingleton = makeAppRuntime();
  }
  return runtimeSingleton;
}

export async function disposeAppRuntime(): Promise<void> {
  if (runtimeSingleton) {
    const rt = runtimeSingleton;
    runtimeSingleton = undefined;
    await rt.dispose();
  }
}
