/**
 * Tuple-returning async wrapper. Resolves to `[err, null]` on rejection or
 * `[null, value]` on success (Go-style: error first).
 *
 * The error type defaults to `Error` but is generic — provide a narrower type
 * when the rejecting promise is known to reject with a specific shape.
 *
 * Usage:
 *
 * ```ts
 * const [err, user] = await handlePromise(loadUser(id));
 * if (err) return notFound();
 * ```
 */
export const handlePromise = <T, E = Error>(promise: Promise<T>): Promise<[E, null] | [null, T]> =>
  promise.then<[null, T]>((data: T) => [null, data]).catch<[E, null]>((err: E) => [err, null]);
