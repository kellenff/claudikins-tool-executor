/**
 * The `DeliverAt` module defines the protocol used by cluster message payloads that carry their own
 * scheduled delivery time. A value implements the protocol by exposing a method at the `DeliverAt`
 * symbol that returns the target `DateTime`.
 *
 * @since 4.0.0
 */
import type { DateTime } from "../../DateTime.ts";
import { hasProperty } from "../../Predicate.ts";

/**
 * Defines the property key used by values that provide a scheduled delivery time.
 *
 * **When to use**
 *
 * Use to implement the scheduled-delivery protocol on cluster message payloads by defining a method
 * at this property key.
 *
 * @since 4.0.0
 * @category Symbols
 */
export const symbol = "~effect/cluster/DeliverAt";

/**
 * Interface for payloads that specify when a cluster message should be delivered by returning the
 * target delivery `DateTime` through the `DeliverAt` symbol method.
 *
 * @since 4.0.0
 * @category Models
 */
export interface DeliverAt {
  [symbol](): DateTime;
}

/**
 * Returns `true` if the value implements the `DeliverAt` scheduled-delivery protocol.
 *
 * @since 4.0.0
 * @category Guards
 */
export const isDeliverAt = (self: unknown): self is DeliverAt => hasProperty(self, symbol);

/**
 * Returns the scheduled delivery time in epoch milliseconds when the value implements `DeliverAt`,
 * or `null` otherwise.
 *
 * @since 4.0.0
 * @category Accessors
 */
export const toMillis = (self: unknown): number | null => {
  if (isDeliverAt(self)) {
    return self[symbol]().epochMilliseconds;
  }
  return null;
};
