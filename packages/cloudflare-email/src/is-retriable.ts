import { NotifyRpcProviderError } from '@betternotify/core';

export const isCloudflareEmailRetriable = (err: unknown): boolean => {
  if (err instanceof NotifyRpcProviderError) return err.retriable;
  return true;
};
