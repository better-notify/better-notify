import type { Middleware } from './types.js';

/**
 * Short-circuit every send with a synthetic `SendResult` carrying
 * `messageId: 'dry-run'`. The downstream pipeline (render, transport) never
 * runs.
 *
 * Use during development, in CI, or under a feature flag to exercise the
 * full caller-side flow without delivering real email. Combine with
 * `withSuppressionList` to selectively block-while-running in non-prod
 * environments.
 */
export const withDryRun = (): Middleware => {
  return async () => ({
    messageId: 'dry-run',
    accepted: [],
    rejected: [],
    envelope: { from: '', to: [] },
    timing: { renderMs: 0, sendMs: 0 },
  });
};
