import { Effect, Option, Schema, SchemaIssue } from "effect";
import type { z } from "zod";

/**
 * Adapt a Zod schema into an `effect.Schema` whose decode runs the full Zod pipeline (`safeParse`:
 * refine / transform / brand / lazy / defaults / strict).
 *
 * Encoded side is `unknown` — callers pass MCP/JSON values.
 */
export function schemaFromZod<T>(zodSchema: z.ZodType<T>): Schema.Codec<T, unknown> {
  return Schema.declareConstructor<T, unknown>()(
    [],
    () => (input, ast, _options) => {
      const parsed = zodSchema.safeParse(input);
      if (parsed.success) {
        return Effect.succeed(parsed.data);
      }
      return Effect.fail(new SchemaIssue.InvalidType(ast, Option.some(input)));
    },
    {
      title: "ZodSchema",
      description: "effect.Schema adapter over Zod (full safeParse pipeline)",
    },
  );
}

/** Sync helper for call sites / tests that still want throw-on-fail. */
export function decodeZodSync<T>(zodSchema: z.ZodType<T>, input: unknown): T {
  return Schema.decodeUnknownSync(schemaFromZod(zodSchema))(input);
}
