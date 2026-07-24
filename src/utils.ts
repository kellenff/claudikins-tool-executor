/**
 * Creates a Promise that rejects with a timeout error after the specified delay.
 *
 * The returned Promise never resolves; after `timeout` milliseconds it rejects with an Error whose
 * message indicates the elapsed timeout in milliseconds. Intended for use as a timeout/race
 * counterpart that bounds the duration of another asynchronous operation.
 *
 * @param {number} timeout - The delay in milliseconds after which the Promise rejects.
 * @param {Error} rejection - Reserved rejection value; not currently used by the implementation.
 * @returns {Promise<never>} A Promise that rejects with a timeout error once the delay elapses.
 */
export const sleep = async (timeout: number, rejection: Error): Promise<never> =>
  // oxlint-disable-next-line promise/avoid-new
  await new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(rejection);
    }, timeout);
  });

/**
 * Type guard that filters out null and undefined values from an array.
 *
 * @param {T | null | undefined} value - The value to check.
 * @returns {boolean} True if the value is neither null nor undefined.
 */
export const notNullish = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;
