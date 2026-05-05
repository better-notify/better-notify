import { NotifyRpcProviderError } from '../errors.js';

export const isProviderRetriable = (err: unknown): boolean => {
  if (err instanceof NotifyRpcProviderError) return err.retriable;
  return true;
};
