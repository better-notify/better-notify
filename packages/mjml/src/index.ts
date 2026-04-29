import { NotifyRpcNotImplementedError } from '@betternotify/core';
import type { TemplateAdapter } from '@betternotify/email';

/** @experimental MJML template adapter — not yet implemented; ships in v0.4. */
export const mjmlTemplate = <TInput>(_source: string): TemplateAdapter<TInput> => {
  return {
    render: async (_args) => {
      throw new NotifyRpcNotImplementedError('@betternotify/mjml (v0.4)');
    },
  };
};
