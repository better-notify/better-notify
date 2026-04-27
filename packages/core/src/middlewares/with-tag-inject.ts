import type { Middleware } from './types.js';
import type { WithTagInjectOptions } from './with-tag-inject.types.js';

/**
 * Inject a static `tags` map into ctx as `tagsToInject`, available to
 * downstream middleware and to anything that reads ctx in the chain.
 *
 * Note: in v0.1 this only mutates ctx — it does NOT yet write tags into the
 * outgoing message headers automatically. That wiring lands when middleware
 * gains the ability to mutate `args` (tracked as a follow-up to the Layer 4
 * stateful-middleware design).
 */
export const withTagInject = (opts: WithTagInjectOptions): Middleware => {
  return async ({ next }) => next({ tagsToInject: opts.tags } as never);
};
