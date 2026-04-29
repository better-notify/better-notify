import { NotifyRpcNotImplementedError } from '@betternotify/core';
import type { TemplateAdapter } from '@betternotify/email';

/** @experimental Handlebars template adapter — not yet implemented; ships in v0.4. */
export const handlebarsTemplate = <TInput>(_source: string): TemplateAdapter<TInput> => {
  return {
    render: async (_args) => {
      throw new NotifyRpcNotImplementedError('@betternotify/handlebars (v0.4)');
    },
  };
};
