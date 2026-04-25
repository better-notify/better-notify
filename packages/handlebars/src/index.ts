import { EmailRpcNotImplementedError, type TemplateAdapter } from '@emailrpc/core';

export function handlebarsTemplate<TInput>(_source: string): TemplateAdapter<TInput> {
  return {
    render: async () => {
      throw new EmailRpcNotImplementedError('@emailrpc/handlebars (v0.4)');
    },
  };
}
