export type RenderedZapier = {
  event: string;
  data: Record<string, unknown>;
  meta?: Record<string, string>;
  webhookUrl?: string;
};

export type ZapierSendArgs<TInput = unknown> = {
  input: TInput;
};

export type ZapierWebhookPayload = {
  event: string;
  route: string;
  messageId: string;
  timestamp: string;
  data: Record<string, unknown>;
  meta?: Record<string, string>;
};

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
