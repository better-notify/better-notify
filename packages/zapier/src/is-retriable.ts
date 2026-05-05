import { NotifyRpcProviderError } from '@betternotify/core';

export const isZapierRetriable = (err: unknown): boolean => {
  if (err instanceof NotifyRpcProviderError) return err.retriable;
  return true;
};
