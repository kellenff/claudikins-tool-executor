import { describe, expect, it } from "vitest";
import { Effect } from "effect";

import { makeAppRuntime } from "./runtime.js";

describe("runtime", () => {
  it("builds and disposes", async () => {
    const runtime = makeAppRuntime();
    await runtime.runPromise(Effect.void);
    await runtime.dispose();
    expect(true).toBe(true);
  });
});
