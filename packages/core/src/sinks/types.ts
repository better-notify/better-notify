export type SendEventStatus = 'success' | 'error';

export type SendEventError = {
  name: string;
  message: string;
  code?: string;
};

export type SendEvent<TResult = unknown> = {
  route: string;
  messageId: string;
  status: SendEventStatus;
  durationMs: number;
  startedAt: Date;
  endedAt: Date;
  result?: TResult;
  error?: SendEventError;
};

export type EventSink<TResult = unknown> = {
  write(event: SendEvent<TResult>): Promise<void>;
};
