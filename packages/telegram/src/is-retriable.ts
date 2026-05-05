import { NotifyRpcProviderError } from '@betternotify/core';

export const isTelegramRetriable = (err: unknown): boolean => {
  if (err instanceof NotifyRpcProviderError) return err.retriable;
  return true;
};
