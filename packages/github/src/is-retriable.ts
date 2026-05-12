import { NotifyRpcProviderError } from '@betternotify/core';

/** Returns whether an error is safe to retry. Unknown errors default to non-retriable. */
export const isGithubRetriable = (err: unknown): boolean => {
  if (err instanceof NotifyRpcProviderError) return err.retriable;
  return false;
};
