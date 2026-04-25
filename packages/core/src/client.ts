import type { Provider } from './provider.js';
import type { Address, SendResult } from './types.js';
import type { RenderedOutput } from './template.js';
import type { AnyEmailRouter, EmailRouter, InputOf } from './router.js';
import type { EmailRpcError } from './errors.js';

export type ProviderEntry = {
  name: string;
  provider: Provider;
  priority: number;
};

export type ClientHooks = {
  onBeforeSend?: (params: {
    route: string;
    input: unknown;
    messageId: string;
  }) => void | Promise<void>;

  onAfterSend?: (params: {
    route: string;
    result: SendResult;
    durationMs: number;
    messageId: string;
  }) => void | Promise<void>;

  onError?: (params: {
    route: string;
    error: EmailRpcError;
    phase: 'validate' | 'render' | 'send';
    messageId: string;
  }) => void | Promise<void>;
};

export type CreateClientOptions<
  R extends AnyEmailRouter,
  P extends readonly ProviderEntry[],
> = {
  router: R;
  providers: P;
  defaults?: {
    from?: Address;
    replyTo?: Address;
    headers?: Record<string, string>;
  };
  hooks?: ClientHooks;
};

export type SendOptions<P extends readonly ProviderEntry[]> = {
  provider?: P[number]['name'];
};

export type RenderOptions = {
  format: 'html' | 'text';
};

type RouteMethods<TInput, P extends readonly ProviderEntry[]> = {
  send(input: TInput, opts?: SendOptions<P>): Promise<SendResult>;
  render(input: TInput): Promise<RenderedOutput>;
  render(input: TInput, opts: RenderOptions): Promise<string>;
};

export type EmailClient<R extends AnyEmailRouter, P extends readonly ProviderEntry[]> =
  R extends EmailRouter<infer M>
    ? { [K in keyof M & string]: RouteMethods<InputOf<EmailRouter<M>, K>, P> }
    : never;

export async function handlePromise<T>(
  promise: Promise<T>,
): Promise<[T, null] | [null, Error]> {
  try {
    return [await promise, null];
  } catch (err) {
    return [null, err instanceof Error ? err : new Error(String(err))];
  }
}
