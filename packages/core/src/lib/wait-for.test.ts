import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from './wait-for.js';

describe('waitFor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves only after the specified ms have elapsed', async () => {
    let resolved = false;
    const promise = waitFor(100).then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(99);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(resolved).toBe(true);
  });

  it('resolves immediately for ms = 0', async () => {
    let resolved = false;
    const promise = waitFor(0).then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    await promise;
    expect(resolved).toBe(true);
  });
});
