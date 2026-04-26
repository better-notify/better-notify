import { EmailRpcNotImplementedError, type TemplateAdapter } from '@emailrpc/core';

export const handlebarsTemplate = <TInput>(_source: string): TemplateAdapter<TInput> => {
  return {
    render: async (_args) => {
      throw new EmailRpcNotImplementedError('@emailrpc/handlebars (v0.4)');
    },
  };
};
