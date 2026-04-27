import { EmailRpcNotImplementedError } from '@emailrpc/core';
import type { TemplateAdapter } from '@emailrpc/email';

export const mjmlTemplate = <TInput>(_source: string): TemplateAdapter<TInput> => {
  return {
    render: async (_args) => {
      throw new EmailRpcNotImplementedError('@emailrpc/mjml (v0.4)');
    },
  };
};
