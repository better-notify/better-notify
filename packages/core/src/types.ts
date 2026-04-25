export type Address =
  | string
  | { name?: string; address: string }

export interface Attachment {
  filename: string
  content: Buffer | string
  contentType?: string
  cid?: string
}

export interface InlineAsset {
  path?: string
  content?: Buffer | string
  contentType?: string
}

export interface RenderedMessage {
  from: Address
  to: Address[]
  cc?: Address[]
  bcc?: Address[]
  replyTo?: Address
  subject: string
  html: string
  text: string
  headers: Record<string, string>
  attachments: Attachment[]
  inlineAssets: Record<string, InlineAsset>
}

export interface SendResult {
  messageId: string
  providerMessageId?: string
  accepted: string[]
  rejected: string[]
  envelope: { from: string; to: string[] }
  timing: { renderMs: number; sendMs: number }
}

export interface QueueResult {
  jobId: string
  enqueuedAt: Date
  scheduledFor?: Date
}

export type Priority = 'low' | 'normal' | 'high'

export interface Tags {
  [key: string]: string | number | boolean
}

export interface SendContext {
  route: string
  messageId: string
  attempt: number
}
