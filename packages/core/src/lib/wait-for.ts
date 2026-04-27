/**
 * Resolve after `ms` milliseconds via `setTimeout`. Mockable under
 * `vi.useFakeTimers()`.
 */
export const waitFor = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
