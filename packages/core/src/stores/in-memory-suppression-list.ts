import { createSuppressionList } from './create-suppression-list.js';
import type { SuppressionEntry, SuppressionList } from './types.js';

export type InMemorySuppressionListOptions = {
  seed?: Record<string, SuppressionEntry>;
};

export const inMemorySuppressionList = (
  opts: InMemorySuppressionListOptions = {},
): SuppressionList => {
  const map = new Map<string, SuppressionEntry>();
  const list = createSuppressionList({
    get: async (email) => map.get(email) ?? null,
    set: async (email, entry) => {
      map.set(email, entry);
    },
    del: async (email) => {
      map.delete(email);
    },
  });
  if (opts.seed) {
    for (const [email, entry] of Object.entries(opts.seed)) {
      void list.set(email, entry);
    }
  }
  return list;
};
