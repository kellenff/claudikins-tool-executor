import { describe, expect, it } from "vitest";

import {
  executeCode,
  getAvailableClientNames,
  getSandboxClientBindings,
} from "./runtime.js";

describe("sandbox runtime", () => {
  it("executes sandboxed code and summarizes returned values", async () => {
    const result = await executeCode("console.log('ok'); return { status: 'done' };", 2000);

    expect(result.error).toBeUndefined();
    expect(result.logs).toContain("ok");
    expect(result.logs).toContainEqual({ returned: { status: "done" } });
  });

  it("converts execution errors into result objects", async () => {
    const result = await executeCode("throw new Error('kaboom')");
    expect(result.error).toBe("kaboom");
    expect(result.stack).toBeTypeOf("string");
    expect(result.logs).toEqual([]);
  });

  it("summarizes oversized console output", async () => {
    const result = await executeCode(`console.log(${JSON.stringify("x".repeat(600))});`, 2000);

    expect(result.error).toBeUndefined();
    expect(result.logs).toEqual([
      expect.stringContaining("Output truncated"),
    ]);
  });

  it("captures console levels and timeout errors", async () => {
    const logged = await executeCode("console.info('i'); console.warn('w'); console.error('e'); console.debug('d');", 2000);
    expect(logged.logs).toEqual([
      { level: "info", data: ["i"] },
      { level: "warn", data: ["w"] },
      { level: "error", data: ["e"] },
      { level: "debug", data: ["d"] },
    ]);

    const timedOut = await executeCode("await new Promise(() => undefined);", 1);
    expect(timedOut.error).toBe("Execution timed out after 1ms");
  });

  it("publishes deterministic sandbox binding names", () => {
    const names = getAvailableClientNames();
    expect(names.length).toBeGreaterThan(0);

    const bindingNames = getSandboxClientBindings();
    expect(bindingNames.length).toBe(names.length);
    expect(new Set(bindingNames).size).toBe(bindingNames.length);
  });
});
