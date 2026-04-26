import type { SendResult } from '../types.js';

export type EmailEventStatus = 'success' | 'error';

export type EmailEventError = {
  name: string;
  message: string;
  code?: string;
};

export type EmailEvent = {
  route: string;
  messageId: string;
  status: EmailEventStatus;
  durationMs: number;
  startedAt: Date;
  endedAt: Date;
  result?: SendResult;
  error?: EmailEventError;
};

export type EventSink = {
  write(event: EmailEvent): Promise<void>;
};
