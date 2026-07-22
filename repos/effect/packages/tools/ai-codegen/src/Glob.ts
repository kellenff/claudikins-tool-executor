/**
 * Glob pattern matching service.
 *
 * @since 4.0.0
 */
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as GlobLib from "glob";

/**
 * Error during glob pattern matching.
 *
 * @since 4.0.0
 * @category Errors
 */
export class GlobError extends Data.TaggedError("GlobError")<{
  readonly pattern: string | ReadonlyArray<string>;
  readonly cause: unknown;
}> {}

/**
 * Service for glob pattern matching.
 *
 * @since 4.0.0
 * @category Models
 */
export interface Glob {
  readonly glob: (
    pattern: string | ReadonlyArray<string>,
    options?: GlobLib.GlobOptions,
  ) => Effect.Effect<Array<string>, GlobError>;
}

/**
 * Service tag for glob pattern matching used by AI codegen tooling.
 *
 * @since 4.0.0
 * @category Services
 */
export const Glob: Context.Service<Glob, Glob> = Context.Service("@effect/ai-codegen/Glob");

/**
 * Layer providing the Glob service.
 *
 * @since 4.0.0
 * @category Layers
 */
export const layer: Layer.Layer<Glob> = Layer.succeed(Glob, {
  glob: (pattern, options) =>
    Effect.tryPromise({
      try: () =>
        GlobLib.glob(pattern as string | Array<string>, options ?? {}) as Promise<Array<string>>,
      catch: (cause) => new GlobError({ pattern, cause }),
    }),
});
