import { describe, expect, it } from "vitest";
import { Effect, Exit, Schema } from "effect";
import { z } from "zod";

import { schemaFromZod } from "./zod-effect.js";

describe("schemaFromZod", () => {
  const ZodPerson = z
    .object({
      name: z.string().min(1, "name required"),
      age: z.number().int().min(0).default(0),
    })
    .strict();

  const PersonSchema = schemaFromZod(ZodPerson);

  it("decodes valid input through the full Zod pipeline (defaults)", async () => {
    const result = await Effect.runPromise(
      Schema.decodeUnknownEffect(PersonSchema)({ name: "ada" }),
    );
    expect(result).toEqual({ name: "ada", age: 0 });
  });

  it("fails on invalid input", async () => {
    const exit = await Effect.runPromiseExit(
      Schema.decodeUnknownEffect(PersonSchema)({ name: "" }),
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("rejects unknown keys (strict)", async () => {
    const exit = await Effect.runPromiseExit(
      Schema.decodeUnknownEffect(PersonSchema)({ name: "ada", extra: true }),
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("runs refinements", async () => {
    const Refined = z.string().refine((s) => s.startsWith("ok-"), { message: "prefix" });
    const schema = schemaFromZod(Refined);
    await expect(Effect.runPromise(Schema.decodeUnknownEffect(schema)("ok-1"))).resolves.toBe(
      "ok-1",
    );
    const exit = await Effect.runPromiseExit(Schema.decodeUnknownEffect(schema)("bad"));
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("is idempotent for defaults (double decode)", async () => {
    const once = await Effect.runPromise(Schema.decodeUnknownEffect(PersonSchema)({ name: "ada" }));
    const twice = await Effect.runPromise(Schema.decodeUnknownEffect(PersonSchema)(once));
    expect(twice).toEqual(once);
  });
});
