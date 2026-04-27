import { EmailRpcNotImplementedError } from '@emailrpc/core';
import type { TemplateAdapter } from '@emailrpc/email';

export const handlebarsTemplate = <TInput>(_source: string): TemplateAdapter<TInput> => {
  return {
    render: async (_args) => {
      throw new EmailRpcNotImplementedError('@emailrpc/handlebars (v0.4)');
    },
  };
};
