import { describe, it, expect } from 'vitest';
import { createSuppressionList } from './create-suppression-list.js';
import type { SuppressionEntry } from './types.js';

describe('createSuppressionList', () => {
  it('forwards calls to user-supplied storage', async () => {
    const calls: Array<{ op: string; email: string; entry?: SuppressionEntry }> = [];
    const store = new Map<string, SuppressionEntry>();
    const list = createSuppressionList({
      get: async (email) => {
        calls.push({ op: 'get', email });
        return store.get(email) ?? null;
      },
      set: async (email, entry) => {
        calls.push({ op: 'set', email, entry });
        store.set(email, entry);
      },
      del: async (email) => {
        calls.push({ op: 'del', email });
        store.delete(email);
      },
    });

    const entry: SuppressionEntry = { reason: 'unsubscribe', createdAt: new Date() };
    await list.set('User@Example.com', entry);
    expect(await list.get('  USER@example.com  ')).toEqual(entry);
    await list.del('user@example.com');
    expect(await list.get('user@example.com')).toBeNull();

    expect(calls.map((c) => c.email)).toEqual([
      'user@example.com',
      'user@example.com',
      'user@example.com',
      'user@example.com',
    ]);
  });

  it('lets users plug arbitrary backends', async () => {
    const fixed = new Map<string, SuppressionEntry>([
      ['blocked@x.com', { reason: 'manual', createdAt: new Date() }],
    ]);
    const list = createSuppressionList({
      get: async (email) => fixed.get(email) ?? null,
      set: async () => {},
      del: async () => {},
    });
    expect(await list.get('BLOCKED@x.com')).not.toBeNull();
    expect(await list.get('fresh@x.com')).toBeNull();
  });
});
