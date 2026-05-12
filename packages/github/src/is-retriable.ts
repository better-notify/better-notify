import { NotifyRpcProviderError } from '@betternotify/core';

export const isGithubRetriable = (err: unknown): boolean => {
  if (err instanceof NotifyRpcProviderError) return err.retriable;
  return true;
};
