import { NotifyRpcProviderError } from '@betternotify/core';

export const isOneSignalRetriable = (err: unknown): boolean => {
  if (err instanceof NotifyRpcProviderError) return err.retriable;
  return false;
};
