import { EmailRpcNotImplementedError, type TemplateAdapter } from '@emailrpc/core'

export interface ReactEmailAdapterOptions {
  inlineAssets?: Record<
    string,
    { path?: string; content?: Buffer | string; contentType?: string }
  >
  plainText?: boolean
}

export type ReactComponent<TProps> = (props: TProps) => unknown

export function reactEmail<TInput extends object>(
  _Component: ReactComponent<TInput>,
  _opts?: ReactEmailAdapterOptions,
): TemplateAdapter<TInput> {
  return {
    render: async () => {
      throw new EmailRpcNotImplementedError('@emailrpc/react-email (v0.2)')
    },
  }
}
