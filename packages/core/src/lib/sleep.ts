/**
 * Resolve after `ms` milliseconds via `setTimeout`. Mockable under
 * `vi.useFakeTimers()`.
 */
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
