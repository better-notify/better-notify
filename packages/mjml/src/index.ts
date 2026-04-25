import { EmailRpcNotImplementedError, type TemplateAdapter } from '@emailrpc/core'

export function mjmlTemplate<TInput>(_source: string): TemplateAdapter<TInput> {
  return {
    render: async () => {
      throw new EmailRpcNotImplementedError('@emailrpc/mjml (v0.4)')
    },
  }
}
