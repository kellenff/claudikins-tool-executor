/**
 * Configuration for Effect CLI command execution.
 *
 * @since 4.0.0
 */
import * as Context from "../../Context.ts";
import * as Layer from "../../Layer.ts";
import * as GlobalFlag from "./GlobalFlag.ts";

/**
 * Context reference for configuration shared by CLI parsing, help generation, and command
 * execution.
 *
 * **When to use**
 *
 * Use when you need to customize runner-wide CLI behavior, such as which built-in global flags are
 * available.
 *
 * @since 4.0.0
 * @category Services
 */
export class CliConfig extends Context.Reference<CliConfig.Service>(
  "effect/unstable/cli/CliConfig",
  {
    defaultValue: () => defaults,
  },
) {}

/**
 * Types used by the `CliConfig` context reference.
 *
 * @since 4.0.0
 */
export declare namespace CliConfig {
  /**
   * Configuration values used while running a CLI command.
   *
   * @since 4.0.0
   * @category Models
   */
  export interface Service {
    /** Ordered built-in global flags, with earlier action flags taking precedence. */
    readonly builtIns: ReadonlyArray<GlobalFlag.BuiltIn>;
  }
}

/**
 * Default CLI configuration containing every built-in global flag.
 *
 * @since 4.0.0
 * @category Defaults
 */
export const defaults: CliConfig.Service = {
  builtIns: GlobalFlag.BuiltIns,
};

/**
 * Creates CLI configuration by merging the provided options over `defaults`.
 *
 * **When to use**
 *
 * Use when you need a configuration value to provide directly through the `CliConfig` context
 * reference.
 *
 * @since 4.0.0
 * @category Constructors
 * @see {@link layer} for providing configuration as a layer
 */
export const make = (options?: Partial<CliConfig.Service>): CliConfig.Service => ({
  ...defaults,
  ...options,
});

/**
 * Creates a layer that provides CLI configuration merged over `defaults`.
 *
 * **When to use**
 *
 * Use when wiring customized CLI behavior into an application layer.
 *
 * @since 4.0.0
 * @category Layers
 * @see {@link make} for creating a configuration value directly
 */
export const layer = (options?: Partial<CliConfig.Service>): Layer.Layer<never> =>
  Layer.succeed(CliConfig, make(options));
