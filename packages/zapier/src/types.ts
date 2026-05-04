export type RenderedZapier = {
  event: string;
  data: Record<string, unknown>;
  meta?: Record<string, string>;
  webhookUrl?: string;
};

export type ZapierSendArgs<TInput = unknown> = {
  input: TInput;
};

/**
 * Wire format for the Zapier channel webhook POST body.
 *
 * The payload is intentionally semi-opinionated: envelope fields (`event`, `route`,
 * `messageId`, `timestamp`) are auto-injected so Zapier users always have stable,
 * consistent top-level fields to filter and branch on — without requiring every
 * route to redeclare them. The `data` field is fully user-defined (whatever the
 * `.data()` slot resolver returns), keeping business payloads flexible. Optional
 * `meta` provides a filtering namespace separate from `data` so automation routing
 * logic doesn't couple to domain models.
 */
export type ZapierWebhookPayload = {
  event: string;
  route: string;
  messageId: string;
  timestamp: string;
  data: Record<string, unknown>;
  meta?: Record<string, string>;
};

/**
 * Wire format for the Zapier email transport POST body.
 *
 * Mirrors `RenderedMessage` fields as flat, individually-addressable JSON so Zapier
 * users can map each field (subject, html, to[0].email, etc.) to downstream actions
 * without parsing. Addresses are normalized to `{ name?, email }` objects rather than
 * RFC 5322 strings for the same reason. Envelope fields (`type`, `route`, `messageId`,
 * `timestamp`) are injected for consistent filtering across both channel and email
 * payloads.
 */
export type ZapierEmailPayload = {
  type: 'email';
  route: string;
  messageId: string;
  timestamp: string;
  from: { name?: string; email: string } | null;
  to: Array<{ name?: string; email: string }>;
  cc: Array<{ name?: string; email: string }>;
  bcc: Array<{ name?: string; email: string }>;
  replyTo: { name?: string; email: string } | null;
  subject: string;
  html: string;
  text: string | null;
  headers: Record<string, string>;
  tags: Record<string, string | number | boolean>;
  attachments: Array<{ filename: string; content: string; contentType?: string }>;
};
