import { NotifyRpcNotImplementedError } from '@betternotify/core';
import type { TemplateAdapter } from '@betternotify/email';

export const handlebarsTemplate = <TInput>(_source: string): TemplateAdapter<TInput> => {
  return {
    render: async (_args) => {
      throw new NotifyRpcNotImplementedError('@betternotify/handlebars (v0.4)');
    },
  };
};
