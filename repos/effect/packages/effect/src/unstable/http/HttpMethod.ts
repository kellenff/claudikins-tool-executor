/**
 * Defines supported HTTP method names for the unstable HTTP modules.
 *
 * Values are uppercase string literals such as `"GET"` and `"POST"`, matching the method tokens
 * used by HTTP requests and routes. This module also includes helpers for checking whether a method
 * can carry a request body and whether an unknown value is one of the supported methods.
 *
 * @since 4.0.0
 */

/**
 * Union of supported uppercase HTTP method literals.
 *
 * @since 4.0.0
 * @category Models
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS" | "TRACE";

/**
 * Namespace containing subtype helpers associated with `HttpMethod`.
 *
 * @since 4.0.0
 */
export declare namespace HttpMethod {
  /**
   * HTTP methods that this module treats as not carrying a request body.
   *
   * @since 4.0.0
   * @category Models
   */
  export type NoBody = "GET" | "HEAD" | "OPTIONS" | "TRACE";

  /**
   * HTTP methods that this module treats as capable of carrying a request body.
   *
   * @since 4.0.0
   * @category Models
   */
  export type WithBody = Exclude<HttpMethod, NoBody>;
}

/**
 * Returns `true` when a method can carry a request body and narrows it to `HttpMethod.WithBody`.
 *
 * @since 4.0.0
 * @category Predicates
 */
export const hasBody = (method: HttpMethod): method is HttpMethod.WithBody =>
  method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && method !== "TRACE";

/**
 * Provides a readonly set containing every supported `HttpMethod` literal.
 *
 * **When to use**
 *
 * Use when you need to iterate over or test membership against every supported HTTP method literal.
 *
 * @since 4.0.0
 * @category Constants
 */
export const all: ReadonlySet<HttpMethod> = new Set([
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
  "TRACE",
]);

/**
 * Provides tuples mapping each supported HTTP method to its short request-constructor name.
 *
 * **When to use**
 *
 * Use when you need the mapping from supported HTTP method literals to their short
 * request-constructor names.
 *
 * @since 4.0.0
 * @category Constants
 */
export const allShort = [
  ["GET", "get"],
  ["POST", "post"],
  ["PUT", "put"],
  ["DELETE", "del"],
  ["PATCH", "patch"],
  ["HEAD", "head"],
  ["OPTIONS", "options"],
  ["TRACE", "trace"],
] as const;

/**
 * Checks whether a value is a `HttpMethod`.
 *
 * **Example** (Checking HTTP method values)
 *
 * ```ts
 * import { HttpMethod } from "effect/unstable/http";
 *
 * console.log(HttpMethod.isHttpMethod("GET"));
 * // true
 * console.log(HttpMethod.isHttpMethod("get"));
 * // false
 * console.log(HttpMethod.isHttpMethod(1));
 * // false
 * ```
 *
 * @since 4.0.0
 * @category Refinements
 */
export const isHttpMethod = (u: unknown): u is HttpMethod => all.has(u as HttpMethod);
