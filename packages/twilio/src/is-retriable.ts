import { NotifyRpcProviderError } from '@betternotify/core';

export const isTwilioRetriable = (err: unknown): boolean => {
  if (err instanceof NotifyRpcProviderError) return err.retriable;
  return true;
};
