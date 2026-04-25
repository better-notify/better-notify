import { validate } from './schema.js';
import { EmailRpcError } from './errors.js';
import type { Provider } from './provider.js';
import type { Address, Attachment, SendResult, RenderedMessage, SendContext } from './types.js';
import type { RenderedOutput, TemplateAdapter } from './template.js';
import type { AnyEmailRouter, EmailRouter, InputOf } from './router.js';
import type { EmailDefinition, SubjectResolver } from './builder.js';
import type { AnyStandardSchema } from './schema.js';
import type { Plugin } from './plugin.js';
import type { AnyMiddleware } from './middleware.js';
import { consoleLogger, type LoggerLike } from './logger.js';

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

export type RouteUnion<R extends AnyEmailRouter> = {
  [K in keyof R['emails'] & string]: {
    route: K;
    input: R extends EmailRouter<any> ? InputOf<R, K> : unknown;
  };
}[keyof R['emails'] & string];

export type BeforeSendCtx<R extends AnyEmailRouter> = RouteUnion<R> & {
  args: SendArgs<unknown>;
  ctx: unknown;
  messageId: string;
};

export type ExecuteCtx<R extends AnyEmailRouter> = BeforeSendCtx<R> & {
  rendered: RenderedMessage;
};

export type AfterSendCtx<R extends AnyEmailRouter> = BeforeSendCtx<R> & {
  result: SendResult;
  durationMs: number;
};

export type ErrorPhase = 'validate' | 'middleware' | 'render' | 'send' | 'hook';

export type ErrorCtx<R extends AnyEmailRouter> = BeforeSendCtx<R> & {
  error: EmailRpcError;
  phase: ErrorPhase;
};

export type HookFn<T> = (params: T) => void | Promise<void>;

export type ClientHooks<R extends AnyEmailRouter = AnyEmailRouter> = {
  onBeforeSend?: HookFn<BeforeSendCtx<R>> | HookFn<BeforeSendCtx<R>>[];
  onExecute?: HookFn<ExecuteCtx<R>> | HookFn<ExecuteCtx<R>>[];
  onAfterSend?: HookFn<AfterSendCtx<R>> | HookFn<AfterSendCtx<R>>[];
  onError?: HookFn<ErrorCtx<R>> | HookFn<ErrorCtx<R>>[];
};

export type CreateClientOptions<R extends AnyEmailRouter, P extends readonly ProviderEntry[]> = {
  router: R;
  providers: P;
  defaults?: {
    from?: Address;
    replyTo?: Address;
    headers?: Record<string, string>;
  };
  hooks?: ClientHooks<R>;
  logger?: LoggerLike;
  plugins?: ReadonlyArray<Plugin<NoInfer<R>> | Plugin>;
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

export const handlePromise = async <T>(promise: Promise<T>): Promise<[T, null] | [null, Error]> => {
  try {
    return [await promise, null];
  } catch (err) {
    return [null, err instanceof Error ? err : new Error(String(err))];
  }
};

const HANDLED = Symbol.for('emailrpc.error.handled');

const markHandled = (err: unknown): void => {
  if (err && typeof err === 'object') {
    (err as Record<symbol, true>)[HANDLED] = true;
  }
};

const isHandled = (err: unknown): boolean => {
  return !!(err && typeof err === 'object' && (err as Record<symbol, unknown>)[HANDLED]);
};

const normalizeAddress = (addr: Address): string => {
  return typeof addr === 'string' ? addr : addr.address;
};

const resolveSubject = <T>(
  resolver: SubjectResolver<T>,
  input: T,
  adapterSubject: string | undefined,
): string => {
  if (adapterSubject) return adapterSubject;
  if (typeof resolver === 'function') return resolver({ input });
  return resolver;
};

type SendPipelineContext = {
  providersByName: Map<string, Provider>;
  defaultProvider: ProviderEntry | undefined;
  defaults?: CreateClientOptions<AnyEmailRouter, readonly ProviderEntry[]>['defaults'];
  normalizedHooks: NormalizedHooks;
  pluginMiddleware: ReadonlyArray<AnyMiddleware>;
  logger: LoggerLike;
  route: string;
};

type NormalizedHooks = {
  onBeforeSend: HookFn<any>[];
  onExecute: HookFn<any>[];
  onAfterSend: HookFn<any>[];
  onError: HookFn<any>[];
};

const toArray = <T>(v: T | T[] | undefined): T[] => {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
};

const runHooks = async <T>(
  handlers: HookFn<any>[],
  params: T,
  onHookFailure: (err: Error) => Promise<void>,
): Promise<Error | null> => {
  let firstError: Error | null = null;
  for (const fn of handlers) {
    const [, err] = await handlePromise((async () => fn(params))());
    if (err) {
      if (!firstError) firstError = err;
      await onHookFailure(err);
    }
  }
  return firstError;
};

const reportHookError = async (
  hookErrorHandlers: HookFn<any>[],
  baseCtx: Record<string, unknown>,
  err: Error,
  log: LoggerLike,
  hook: string,
): Promise<void> => {
  log.error('hook failed', { err, hook });
  const errorParams = {
    ...baseCtx,
    error:
      err instanceof EmailRpcError
        ? err
        : new EmailRpcError({ message: err.message, code: 'UNKNOWN', cause: err }),
    phase: 'hook' as const,
  };
  for (const fn of hookErrorHandlers) {
    const [, nestedErr] = await handlePromise((async () => fn(errorParams))());
    if (nestedErr) log.error('hook failed', { err: nestedErr, hook: 'onError' });
  }
};

const executeRender = async (
  def: EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown>>,
  rawInput: unknown,
  opts?: RenderOptions,
): Promise<RenderedOutput | string> => {
  const input = await validate(def.schema, rawInput, { route: def.id });
  const rendered = await def.template.render(input);

  if (!opts) return rendered;

  if (opts.format === 'html') return rendered.html;
  return rendered.text ?? '';
};

type RawSendArgs = {
  to: Address | Address[];
  cc?: Address | Address[];
  bcc?: Address | Address[];
  replyTo?: Address;
  headers?: Record<string, string>;
  attachments?: Attachment[];
  input: unknown;
};

const toAddressArray = (value: Address | Address[]): Address[] => {
  return Array.isArray(value) ? value : [value];
};

type SendCore = (currentCtx: unknown) => Promise<SendResult>;

const buildMessage = (
  def: EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown>>,
  args: RawSendArgs,
  input: unknown,
  rendered: { html: string; text?: string; subject?: string },
  ctx: SendPipelineContext,
  messageId: string,
): RenderedMessage => {
  const subject = resolveSubject(def.subject, input, rendered.subject);
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
    html: rendered.html,
    text: rendered.text ?? '',
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
  return message;
};

const composeMiddleware = (
  middlewares: ReadonlyArray<AnyMiddleware>,
  core: SendCore,
  baseInput: unknown,
  route: string,
): ((ctx: unknown) => Promise<SendResult>) => {
  let chain: (ctx: unknown) => Promise<SendResult> = (ctx) => core(ctx);
  for (let i = middlewares.length - 1; i >= 0; i--) {
    const mw = middlewares[i]!;
    const downstream = chain;
    chain = (currentCtx) =>
      mw({
        input: baseInput,
        ctx: currentCtx,
        route,
        next: (newCtx) =>
          downstream(newCtx ? { ...(currentCtx as object), ...newCtx } : currentCtx),
      });
  }
  return (ctx) => chain(ctx);
};

const pickProvider = (
  ctx: SendPipelineContext,
  opts: { provider?: string } | undefined,
  messageId: string,
): Provider => {
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
    return found;
  }
  if (!ctx.defaultProvider) {
    throw new EmailRpcError({
      message: 'No providers registered.',
      code: 'PROVIDER',
      route: ctx.route,
      messageId,
    });
  }
  return ctx.defaultProvider.provider;
};

const executeSend = async (
  def: EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown>>,
  args: RawSendArgs,
  opts: { provider?: string } | undefined,
  ctx: SendPipelineContext,
): Promise<SendResult> => {
  const messageId = crypto.randomUUID();
  const log = ctx.logger.child({ route: ctx.route, messageId });
  log.debug('send start', { to: args.to, hasInput: args.input !== undefined });
  const startedAt = performance.now();
  const initialCtx: Record<string, unknown> = {};
  const baseHookCtx = { route: ctx.route, args, ctx: initialCtx, messageId };

  const [input, validateErr] = await handlePromise(
    validate(def.schema, args.input, { route: ctx.route }),
  );
  if (validateErr) {
    log.warn('validate failed', { err: validateErr });
    await runHooks(
      ctx.normalizedHooks.onError,
      {
        ...baseHookCtx,
        input: undefined,
        error: validateErr as EmailRpcError,
        phase: 'validate' as const,
      },
      (e) => reportHookError(ctx.normalizedHooks.onError, baseHookCtx, e, log, 'onError'),
    );
    markHandled(validateErr);
    throw validateErr;
  }

  const beforeSendParams = { ...baseHookCtx, input };
  const beforeErr = await runHooks(ctx.normalizedHooks.onBeforeSend, beforeSendParams, (e) =>
    reportHookError(ctx.normalizedHooks.onError, beforeSendParams, e, log, 'onBeforeSend'),
  );
  if (beforeErr) {
    markHandled(beforeErr);
    throw beforeErr;
  }

  const renderState: { renderMs: number; sendMs: number } = { renderMs: 0, sendMs: 0 };

  const core: SendCore = async (currentCtx) => {
    log.debug('render start', { adapter: def.template?.constructor?.name ?? 'adapter' });
    const renderStart = performance.now();
    const [rendered, renderErr] = await handlePromise(def.template.render(input));
    renderState.renderMs = performance.now() - renderStart;
    if (renderErr) {
      log.warn('render failed', {
        err: renderErr,
        adapter: def.template?.constructor?.name ?? 'adapter',
        durationMs: renderState.renderMs,
      });
      const wrapped = new EmailRpcError({
        message: `Render failed for route "${ctx.route}": ${renderErr.message}`,
        code: 'RENDER',
        route: ctx.route,
        messageId,
        cause: renderErr,
      });
      await runHooks(
        ctx.normalizedHooks.onError,
        { ...beforeSendParams, ctx: currentCtx, error: wrapped, phase: 'render' as const },
        (e) => reportHookError(ctx.normalizedHooks.onError, beforeSendParams, e, log, 'onError'),
      );
      markHandled(wrapped);
      throw wrapped;
    }

    const message = buildMessage(def, args, input, rendered!, ctx, messageId);

    const executeParams = { ...beforeSendParams, ctx: currentCtx, rendered: message };
    const executeErr = await runHooks(ctx.normalizedHooks.onExecute, executeParams, (e) =>
      reportHookError(ctx.normalizedHooks.onError, executeParams, e, log, 'onExecute'),
    );
    if (executeErr) {
      markHandled(executeErr);
      throw executeErr;
    }

    const provider = pickProvider(ctx, opts, messageId);
    const sendContext: SendContext = { route: ctx.route, messageId, attempt: 1 };
    log.debug('provider send', { providerName: provider.name, attempt: 1 });
    const sendStart = performance.now();
    const [providerResult, sendErr] = await handlePromise(provider.send(message, sendContext));
    renderState.sendMs = performance.now() - sendStart;

    if (sendErr) {
      log.error('send failed', {
        err: sendErr,
        providerName: provider.name,
        durationMs: renderState.sendMs,
      });
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
      await runHooks(
        ctx.normalizedHooks.onError,
        { ...executeParams, error: wrapped, phase: 'send' as const },
        (e) => reportHookError(ctx.normalizedHooks.onError, executeParams, e, log, 'onError'),
      );
      markHandled(wrapped);
      throw wrapped;
    }

    const result: SendResult = {
      messageId,
      providerMessageId: providerResult!.providerMessageId,
      accepted: providerResult!.accepted,
      rejected: providerResult!.rejected,
      envelope: {
        from: normalizeAddress(message.from),
        to: message.to.map(normalizeAddress),
      },
      timing: { renderMs: renderState.renderMs, sendMs: renderState.sendMs },
    };
    log.info('send ok', {
      providerName: provider.name,
      durationMs: performance.now() - startedAt,
      providerMessageId: result.providerMessageId,
    });
    return result;
  };

  const allMiddleware = [...ctx.pluginMiddleware, ...def.middleware];
  const composed = composeMiddleware(allMiddleware, core, input, ctx.route);

  const [result, mwErr] = await handlePromise(composed(initialCtx));
  if (mwErr) {
    if (isHandled(mwErr)) throw mwErr;
    const wrapped =
      mwErr instanceof EmailRpcError
        ? mwErr
        : new EmailRpcError({
            message: `Middleware failed for route "${ctx.route}": ${mwErr.message}`,
            code: 'UNKNOWN',
            route: ctx.route,
            messageId,
            cause: mwErr,
          });
    await runHooks(
      ctx.normalizedHooks.onError,
      { ...beforeSendParams, error: wrapped, phase: 'middleware' as const },
      (e) => reportHookError(ctx.normalizedHooks.onError, beforeSendParams, e, log, 'onError'),
    );
    markHandled(wrapped);
    throw wrapped;
  }

  const afterSendParams = {
    ...beforeSendParams,
    result: result!,
    durationMs: renderState.renderMs + renderState.sendMs,
  };
  await runHooks(ctx.normalizedHooks.onAfterSend, afterSendParams, (e) =>
    reportHookError(ctx.normalizedHooks.onError, afterSendParams, e, log, 'onAfterSend'),
  );

  return result!;
};

export const createClient = <R extends AnyEmailRouter, const P extends readonly ProviderEntry[]>(
  options: CreateClientOptions<R, P>,
): EmailClient<R, P> & { close: () => Promise<void> } => {
  const { router, providers } = options;
  const cache = new Map<string, unknown>();

  const sortedProviders = [...providers].sort((a, b) => a.priority - b.priority);
  const defaultProvider = sortedProviders[0];
  const providersByName = new Map(providers.map((p) => [p.name, p.provider]));

  const plugins = options.plugins ?? [];
  const pluginMiddleware: AnyMiddleware[] = plugins.flatMap((p) => p.middleware ?? []);
  const baseLogger = (options.logger ?? consoleLogger()).child({ component: 'client' });

  const mergeHook = <K extends keyof NormalizedHooks>(key: K): HookFn<any>[] => [
    ...plugins.flatMap((p) => toArray(p.hooks?.[key] as HookFn<any> | HookFn<any>[] | undefined)),
    ...toArray(options.hooks?.[key] as HookFn<any> | HookFn<any>[] | undefined),
  ];

  const normalizedHooks: NormalizedHooks = {
    onBeforeSend: mergeHook('onBeforeSend'),
    onExecute: mergeHook('onExecute'),
    onAfterSend: mergeHook('onAfterSend'),
    onError: mergeHook('onError'),
  };

  for (const plugin of plugins) {
    if (plugin.onCreate) plugin.onCreate({ router });
  }

  const close = async (): Promise<void> => {
    for (let i = plugins.length - 1; i >= 0; i--) {
      const plugin = plugins[i]!;
      if (plugin.onClose) {
        const [, err] = await handlePromise((async () => plugin.onClose!())());
        if (err) baseLogger.error('plugin close failed', { err, plugin: plugin.name });
      }
    }
  };

  const target = { close } as { close: () => Promise<void> };
  const proxy = new Proxy(target as unknown as EmailClient<R, P> & { close: () => Promise<void> }, {
    get(t, key: string) {
      if (typeof key !== 'string') return undefined;
      if (key === 'close') return (t as { close: () => Promise<void> }).close;

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
            normalizedHooks,
            pluginMiddleware,
            logger: baseLogger,
            route: key,
          }),
        render: (input: unknown, renderOpts?: RenderOptions) =>
          executeRender(def, input, renderOpts),
      });

      cache.set(key, methods);
      return methods;
    },
  });

  return proxy;
};
