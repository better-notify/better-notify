export type Address = string | { name?: string; email: string };

export type FromInput = string | { name?: string; email?: string };

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

export type Priority = 'low' | 'normal' | 'high';

export type Tags = {
  [key: string]: string | number | boolean;
};

export type RenderedMessage = {
  from: Address;
  to: Address[];
  cc?: Address[];
  bcc?: Address[];
  replyTo?: Address;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
  attachments?: Attachment[];
  inlineAssets?: Record<string, InlineAsset>;
  tags?: Tags;
  priority?: Priority;
};

export type SendContext = {
  route: string;
  messageId: string;
  attempt: number;
};

export type RawSendArgs = {
  to: Address | Address[];
  cc?: Address | Address[];
  bcc?: Address | Address[];
  replyTo?: Address;
  headers?: Record<string, string>;
  attachments?: Attachment[];
  input: unknown;
};
