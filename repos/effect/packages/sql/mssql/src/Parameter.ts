/**
 * Typed SQL Server stored procedure parameter metadata.
 *
 * This module builds {@link Parameter} values that pair a stored procedure parameter name with a
 * Tedious `DataType`, Tedious `ParameterOptions`, and a phantom TypeScript value type.
 * `Procedure.param` and `Procedure.outputParam` use this metadata, and `MssqlClient.call` forwards
 * it to Tedious when registering input and output parameters.
 *
 * @since 4.0.0
 * @see {@link make} for constructing parameter metadata directly.
 */
import { identity } from "effect/Function";
import type { DataType } from "tedious/lib/data-type.ts";
import type { ParameterOptions } from "tedious/lib/request.ts";

/**
 * Runtime type identifier used to mark SQL Server stored procedure parameter metadata.
 *
 * @since 4.0.0
 * @category Type IDs
 */
export const TypeId: TypeId = "~@effect/sql-mssql/Parameter";

/**
 * Type-level identifier used to mark SQL Server stored procedure parameter metadata.
 *
 * @since 4.0.0
 * @category Type IDs
 */
export type TypeId = "~@effect/sql-mssql/Parameter";

/**
 * Metadata for a SQL Server stored procedure parameter, including its name, Tedious data type,
 * options, and phantom value type.
 *
 * @since 4.0.0
 * @category Models
 */
export interface Parameter<out A> {
  readonly [TypeId]: (_: never) => A;
  readonly _tag: "Parameter";
  readonly name: string;
  readonly type: DataType;
  readonly options: ParameterOptions;
}

/**
 * Creates typed metadata for a SQL Server stored procedure parameter.
 *
 * @since 4.0.0
 * @category Constructors
 */
export const make = <A>(
  name: string,
  type: DataType,
  options: ParameterOptions = {},
): Parameter<A> => ({
  [TypeId]: identity,
  _tag: "Parameter",
  name,
  type,
  options,
});
