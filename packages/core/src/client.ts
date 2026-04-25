import { validate } from './schema.js';
import { EmailRpcError } from './errors.js';
import type { Provider } from './provider.js';
import type { Address, Attachment, SendResult, RenderedMessage, SendContext } from './types.js';
import type { RenderedOutput, TemplateAdapter } from './template.js';
import type { AnyEmailRouter, EmailRouter, InputOf } from './router.js';
import type { EmailDefinition, SubjectResolver } from './builder.js';
import type { AnyStandardSchema } from './schema.js';

export type SendArgs<TInput> = {
  to: Address | Address[];
  cc?: Address | Address[];
  bcc?: Address | Address[];
  replyTo?: Address;
  headers?: Record<string, string>;
  attachments?: Attachment[];
  input: TInput;
};

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

export type CreateClientOptions<R extends AnyEmailRouter, P extends readonly ProviderEntry[]> = {
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
  send(args: SendArgs<TInput>, opts?: SendOptions<P>): Promise<SendResult>;
  render(input: TInput): Promise<RenderedOutput>;
  render(input: TInput, opts: RenderOptions): Promise<string>;
};

export type EmailClient<R extends AnyEmailRouter, P extends readonly ProviderEntry[]> =
  R extends EmailRouter<infer M>
    ? { [K in keyof M & string]: RouteMethods<InputOf<EmailRouter<M>, K>, P> }
    : never;

export async function handlePromise<T>(promise: Promise<T>): Promise<[T, null] | [null, Error]> {
  try {
    return [await promise, null];
  } catch (err) {
    return [null, err instanceof Error ? err : new Error(String(err))];
  }
}

function normalizeAddress(addr: Address): string {
  return typeof addr === 'string' ? addr : addr.address;
}

function resolveSubject<T>(
  resolver: SubjectResolver<T>,
  input: T,
  adapterSubject: string | undefined,
): string {
  if (adapterSubject) return adapterSubject;
  if (typeof resolver === 'function') return resolver({ input });
  return resolver;
}

type SendPipelineContext = {
  providersByName: Map<string, Provider>;
  defaultProvider: ProviderEntry | undefined;
  defaults?: CreateClientOptions<AnyEmailRouter, readonly ProviderEntry[]>['defaults'];
  hooks?: ClientHooks;
  route: string;
};

async function fireHookSafe(fn: (() => void | Promise<void>) | undefined): Promise<void> {
  if (!fn) return;
  const [, err] = await handlePromise(new Promise<void>((resolve) => resolve(fn())));
  if (err) console.error('[emailrpc] hook error:', err);
}

async function executeRender(
  def: EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown>>,
  rawInput: unknown,
  opts?: RenderOptions,
): Promise<RenderedOutput | string> {
  const input = await validate(def.schema, rawInput, { route: def.id });
  const rendered = await def.template.render(input);

  if (!opts) return rendered;

  if (opts.format === 'html') return rendered.html;
  return rendered.text ?? '';
}

type RawSendArgs = {
  to: Address | Address[];
  cc?: Address | Address[];
  bcc?: Address | Address[];
  replyTo?: Address;
  headers?: Record<string, string>;
  attachments?: Attachment[];
  input: unknown;
};

function toAddressArray(value: Address | Address[]): Address[] {
  return Array.isArray(value) ? value : [value];
}

async function executeSend(
  def: EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown>>,
  args: RawSendArgs,
  opts: { provider?: string } | undefined,
  ctx: SendPipelineContext,
): Promise<SendResult> {
  const messageId = crypto.randomUUID();

  const [input, validateErr] = await handlePromise(
    validate(def.schema, args.input, { route: ctx.route }),
  );
  if (validateErr) {
    await fireHookSafe(
      ctx.hooks?.onError
        ? () =>
            ctx.hooks!.onError!({
              route: ctx.route,
              error: validateErr as EmailRpcError,
              phase: 'validate',
              messageId,
            })
        : undefined,
    );
    throw validateErr;
  }

  await fireHookSafe(
    ctx.hooks?.onBeforeSend
      ? () => ctx.hooks!.onBeforeSend!({ route: ctx.route, input, messageId })
      : undefined,
  );

  const renderStart = performance.now();
  const [rendered, renderErr] = await handlePromise(def.template.render(input));
  const renderMs = performance.now() - renderStart;

  if (renderErr) {
    const wrapped = new EmailRpcError({
      message: `Render failed for route "${ctx.route}": ${renderErr.message}`,
      code: 'RENDER',
      route: ctx.route,
      messageId,
      cause: renderErr,
    });
    await fireHookSafe(
      ctx.hooks?.onError
        ? () =>
            ctx.hooks!.onError!({
              route: ctx.route,
              error: wrapped,
              phase: 'render',
              messageId,
            })
        : undefined,
    );
    throw wrapped;
  }

  const subject = resolveSubject(def.subject, input, rendered!.subject);

  const fromAddr = def.from ?? ctx.defaults?.from;
  if (!fromAddr) {
    throw new EmailRpcError({
      message: `No "from" address for route "${ctx.route}": set it on the email definition or in client defaults.`,
      code: 'VALIDATION',
      route: ctx.route,
      messageId,
    });
  }

  const toAddresses = toAddressArray(args.to);

  const message: RenderedMessage = {
    from: fromAddr,
    to: toAddresses,
    subject,
    html: rendered!.html,
    text: rendered!.text ?? '',
    headers: { ...ctx.defaults?.headers, ...args.headers },
    attachments: args.attachments ?? [],
    inlineAssets: {},
  };

  if (args.cc) message.cc = toAddressArray(args.cc);
  if (args.bcc) message.bcc = toAddressArray(args.bcc);

  const replyTo = args.replyTo ?? def.replyTo ?? ctx.defaults?.replyTo;
  if (replyTo) message.replyTo = replyTo;

  if (def.tags) {
    for (const [k, v] of Object.entries(def.tags)) {
      message.headers[`X-EmailRpc-Tag-${k}`] = String(v);
    }
  }

  let provider: Provider;
  if (opts?.provider) {
    const found = ctx.providersByName.get(opts.provider);
    if (!found) {
      throw new EmailRpcError({
        message: `Provider "${opts.provider}" is not registered.`,
        code: 'PROVIDER',
        route: ctx.route,
        messageId,
      });
    }
    provider = found;
  } else if (ctx.defaultProvider) {
    provider = ctx.defaultProvider.provider;
  } else {
    throw new EmailRpcError({
      message: 'No providers registered.',
      code: 'PROVIDER',
      route: ctx.route,
      messageId,
    });
  }

  const sendContext: SendContext = { route: ctx.route, messageId, attempt: 1 };
  const sendStart = performance.now();
  const [providerResult, sendErr] = await handlePromise(provider.send(message, sendContext));
  const sendMs = performance.now() - sendStart;

  if (sendErr) {
    const wrapped =
      sendErr instanceof EmailRpcError
        ? sendErr
        : new EmailRpcError({
            message: `Provider send failed for route "${ctx.route}": ${sendErr.message}`,
            code: 'PROVIDER',
            route: ctx.route,
            messageId,
            cause: sendErr,
          });
    await fireHookSafe(
      ctx.hooks?.onError
        ? () =>
            ctx.hooks!.onError!({
              route: ctx.route,
              error: wrapped,
              phase: 'send',
              messageId,
            })
        : undefined,
    );
    throw wrapped;
  }

  const result: SendResult = {
    messageId,
    providerMessageId: providerResult!.providerMessageId,
    accepted: providerResult!.accepted,
    rejected: providerResult!.rejected,
    envelope: {
      from: normalizeAddress(fromAddr),
      to: toAddresses.map(normalizeAddress),
    },
    timing: { renderMs, sendMs },
  };

  await fireHookSafe(
    ctx.hooks?.onAfterSend
      ? () =>
          ctx.hooks!.onAfterSend!({
            route: ctx.route,
            result,
            durationMs: renderMs + sendMs,
            messageId,
          })
      : undefined,
  );

  return result;
}

export function createClient<R extends AnyEmailRouter, const P extends readonly ProviderEntry[]>(
  options: CreateClientOptions<R, P>,
): EmailClient<R, P> {
  const { router, providers } = options;
  const cache = new Map<string, unknown>();

  const sortedProviders = [...providers].sort((a, b) => a.priority - b.priority);
  const defaultProvider = sortedProviders[0];
  const providersByName = new Map(providers.map((p) => [p.name, p.provider]));

  return new Proxy({} as EmailClient<R, P>, {
    get(_target, key: string) {
      if (typeof key !== 'string') return undefined;

      const def = (router.emails as Record<string, unknown>)[key] as
        | EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown>>
        | undefined;
      if (!def) return undefined;

      if (cache.has(key)) return cache.get(key);

      const methods = Object.freeze({
        send: (sendArgs: RawSendArgs, sendOpts?: { provider?: string }) =>
          executeSend(def, sendArgs, sendOpts, {
            providersByName,
            defaultProvider,
            defaults: options.defaults,
            hooks: options.hooks,
            route: key,
          }),
        render: (input: unknown, renderOpts?: RenderOptions) =>
          executeRender(def, input, renderOpts),
      });

      cache.set(key, methods);
      return methods;
    },
  });
}
