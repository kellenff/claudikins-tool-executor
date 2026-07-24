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
