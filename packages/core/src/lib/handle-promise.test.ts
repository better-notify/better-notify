import { describe, expect, it } from 'vitest';
import { handlePromise } from './handle-promise.js';

describe('handlePromise', () => {
  it('returns [null, value] on resolve', async () => {
    const [err, value] = await handlePromise(Promise.resolve(42));
    expect(err).toBeNull();
    expect(value).toBe(42);
  });

  it('returns [err, null] on rejection with an Error', async () => {
    const original = new Error('boom');
    const [err, value] = await handlePromise(Promise.reject(original));
    expect(err).toBe(original);
    expect(value).toBeNull();
  });

  it('preserves non-Error rejections as-is (no coercion)', async () => {
    const [err, value] = await handlePromise<number, string>(Promise.reject('plain string'));
    expect(err).toBe('plain string');
    expect(value).toBeNull();
  });

  it('preserves object rejections as-is via the generic E parameter', async () => {
    type Failure = { code: string };
    const fail: Failure = { code: 'X' };
    const [err, value] = await handlePromise<number, Failure>(Promise.reject(fail));
    expect(err).toBe(fail);
    expect(value).toBeNull();
  });
});
