import { NotifyRpcNotImplementedError } from '@betternotify/core';
import type { TemplateAdapter } from '@betternotify/email';

export const mjmlTemplate = <TInput>(_source: string): TemplateAdapter<TInput> => {
  return {
    render: async (_args) => {
      throw new NotifyRpcNotImplementedError('@betternotify/mjml (v0.4)');
    },
  };
};
