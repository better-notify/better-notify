import { describe, it, expect } from 'vitest';
import { inMemorySuppressionList } from './in-memory-suppression-list.js';

describe('inMemorySuppressionList', () => {
  it('returns null for unknown emails', async () => {
    const list = inMemorySuppressionList();
    expect(await list.get('nope@example.com')).toBeNull();
  });

  it('round-trips entries', async () => {
    const list = inMemorySuppressionList();
    const entry = { reason: 'unsubscribe', createdAt: new Date('2026-01-01') };
    await list.set('user@example.com', entry);
    expect(await list.get('user@example.com')).toEqual(entry);
  });

  it('normalizes emails (case-insensitive, trims)', async () => {
    const list = inMemorySuppressionList();
    await list.set('User@Example.com', { reason: 'manual', createdAt: new Date() });
    expect(await list.get('  user@example.com  ')).not.toBeNull();
    expect(await list.get('USER@EXAMPLE.COM')).not.toBeNull();
  });

  it('removes entries via del', async () => {
    const list = inMemorySuppressionList();
    await list.set('x@y.com', { reason: 'bounce', createdAt: new Date() });
    await list.del('x@y.com');
    expect(await list.get('x@y.com')).toBeNull();
  });

  it('seeds initial entries', async () => {
    const seeded = { reason: 'complaint', createdAt: new Date() };
    const list = inMemorySuppressionList({ seed: { 'spam@x.com': seeded } });
    expect(await list.get('spam@x.com')).toEqual(seeded);
  });
});
