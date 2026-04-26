import { normalizeAddress } from '../lib/normalize-address.js';
import { consoleLogger } from '../logger.js';
import type { Address, RawSendArgs, SendResult } from '../types.js';
import type { Middleware } from './types.js';
import type {
  SuppressionField,
  WithSuppressionListOptions,
} from './with-suppression-list.types.js';

const DEFAULT_FIELDS: ReadonlyArray<SuppressionField> = ['to', 'cc', 'bcc'];

const collectAddresses = (
  args: RawSendArgs,
  fields: ReadonlyArray<SuppressionField>,
): string[] => {
  const out: string[] = [];
  for (const field of fields) {
    const value = args[field];
    if (!value) continue;
    const arr: Address[] = Array.isArray(value) ? value : [value];
    for (const addr of arr) out.push(normalizeAddress(addr));
  }
  return out;
};

/**
 * Block sends to recipients present in the supplied `SuppressionList`.
 *
 * Collects addresses from `args.to` / `args.cc` / `args.bcc` (subset
 * selectable via `fields`, defaults to all three) and looks each up in the
 * list. If **any** recipient has a non-null entry the send short-circuits:
 * a synthetic `SendResult { messageId: 'suppressed' }` is returned with the
 * suppressed addresses listed under `rejected`. The downstream pipeline
 * (render, transport) never runs.
 *
 * The matched entries are written to the supplied `logger` at warn level
 * (defaults to `consoleLogger({ level: 'warn' })`). Pass a structured
 * logger (e.g. via `fromPino`) to route into your existing log pipeline.
 *
 * ```ts
 * t.use(withSuppressionList({
 *   list: inMemorySuppressionList({
 *     seed: { 'blocked@x.com': { reason: 'unsubscribe', createdAt: new Date() } },
 *   }),
 * }))
 * ```
 *
 * Pair with the webhook router (Layer 6) to drive bounces and complaints
 * into the same list via `list.set(email, { reason: 'bounce', createdAt })`.
 */
export const withSuppressionList = (opts: WithSuppressionListOptions): Middleware => {
  const fields = opts.fields ?? DEFAULT_FIELDS;
  const logger = opts.logger ?? consoleLogger({ level: 'warn' });

  return async ({ args, route, next }) => {
    const recipients = collectAddresses(args, fields);
    if (recipients.length === 0) return next();

    const lookups = await Promise.all(
      recipients.map(async (email) => ({ email, entry: await opts.list.get(email) })),
    );
    const suppressed = lookups.filter((l) => l.entry !== null);
    if (suppressed.length === 0) return next();

    logger.warn('email suppressed', {
      route,
      suppressed: suppressed.map((s) => ({
        email: s.email,
        reason: s.entry?.reason,
        createdAt: s.entry?.createdAt,
      })),
    });

    const result: SendResult = {
      messageId: 'suppressed',
      accepted: [],
      rejected: recipients,
      envelope: { from: '', to: recipients },
      timing: { renderMs: 0, sendMs: 0 },
    };
    return result;
  };
};
