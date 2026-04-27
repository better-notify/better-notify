import type { RenderedMessage, SendContext } from '../types.js';

/**
 * Result returned by a transport after a single send attempt.
 *
 * - `transportMessageId`: provider-assigned id (e.g. SMTP `Message-Id` header,
 *   SES `MessageId`, Resend `id`). Optional because some providers don't return one.
 * - `accepted` / `rejected`: per-recipient outcome lists (string emails).
 * - `raw`: opaque pass-through of the provider's native response, for debugging.
 */
export type TransportResult = {
  transportMessageId?: string;
  accepted: string[];
  rejected: string[];
  raw?: unknown;
};

/**
 * Wire-level email transport. One instance per provider connection.
 *
 * Implementations receive a fully-resolved `RenderedMessage` (addresses already
 * merged from `defaults.from` + per-email `.from()`; subject/html/text rendered
 * by the template adapter). The transport's only job is to deliver it via its
 * provider and report back. It must not re-validate or re-render — that's the
 * pipeline's job upstream.
 *
 * Use the helpers in `@emailrpc/email/transports` (`formatAddress`,
 * `normalizeAddress`) to convert `Address` values to wire format consistently.
 */
export type Transport = {
  /** Stable identifier; surfaces in logs and `SendOptions.transport` selection. */
  name: string;
  /** Deliver one message. Throw to signal a hard failure (see `TransportResult` for soft outcomes). */
  send(message: RenderedMessage, ctx: SendContext): Promise<TransportResult>;
  /** Optional connectivity check; called by tooling (e.g. `mail.verify()`). */
  verify?(): Promise<{ ok: boolean; details?: unknown }>;
  /** Optional graceful shutdown; called from `mail.close()`. Pool/connection cleanup goes here. */
  close?(): Promise<void>;
};

export type TransportEntry = {
  name: string;
  transport: Transport;
  priority: number;
};
