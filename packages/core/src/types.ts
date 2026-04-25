export type Address = string | { name?: string; address: string };

export type Attachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  cid?: string;
};

export type InlineAsset = {
  path?: string;
  content?: Buffer | string;
  contentType?: string;
};

export type RenderedMessage = {
  from: Address;
  to: Address[];
  cc?: Address[];
  bcc?: Address[];
  replyTo?: Address;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
  attachments: Attachment[];
  inlineAssets: Record<string, InlineAsset>;
};

export type SendResult = {
  messageId: string;
  providerMessageId?: string;
  accepted: string[];
  rejected: string[];
  envelope: { from: string; to: string[] };
  timing: { renderMs: number; sendMs: number };
};

export type QueueResult = {
  jobId: string;
  enqueuedAt: Date;
  scheduledFor?: Date;
};

export type Priority = 'low' | 'normal' | 'high';

export type Tags = {
  [key: string]: string | number | boolean;
};

export type SendContext = {
  route: string;
  messageId: string;
  attempt: number;
};
