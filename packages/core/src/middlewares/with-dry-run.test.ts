import { describe, it, expect } from 'vitest';
import { withDryRun } from './with-dry-run.js';

const noopNext = (_override?: unknown) =>
  Promise.resolve({
    messageId: 'm',
    accepted: ['x@y.com'],
    rejected: [],
    envelope: { from: 'a@b.com', to: ['x@y.com'] },
    timing: { renderMs: 0, sendMs: 0 },
  });

describe('withDryRun', () => {
  it('short-circuits without calling next', async () => {
    const mw = withDryRun();
    let called = false;
    const r = (await mw({
      input: {},
      ctx: {},
      route: 'welcome',
      messageId: 'test-msg',
      args: { to: 'x@y.com', input: {} },
      next: (() => {
        called = true;
        return noopNext();
      }) as never,
    })) as { messageId: string; accepted: string[] };
    expect(called).toBe(false);
    expect(r.messageId).toBe('dry-run');
    expect(r.accepted).toEqual([]);
  });
});
