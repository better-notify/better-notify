import { validate } from './schema.js';
import { EmailRpcError } from './errors.js';
import type { Transport, TransportEntry } from './transports/types.js';
import type {
  Address,
  Attachment,
  FromInput,
  RawSendArgs,
  SendResult,
  RenderedMessage,
  SendContext,
} from './types.js';
import type { RenderedOutput, TemplateAdapter } from './template.js';
import type { AnyEmailCatalog, CtxOf, EmailCatalog, InputOf } from './catalog.js';
import { isEmailCatalog } from './catalog.js';
import type { EmailBuilder, EmailDefinition, SubjectResolver } from './builder.js';
import type { AnyStandardSchema, InferOutput } from './schema.js';
import type { Plugin } from './plugins/types.js';
import type { AnyMiddleware } from './middlewares/types.js';
import { consoleLogger, type LoggerLike } from './logger.js';
import { handlePromise } from './lib/handle-promise.js';

export type SendArgs<TInput> = {
  to: Address | Address[];
  cc?: Address | Address[];
  bcc?: Address | Address[];
  replyTo?: Address;
  headers?: Record<string, string>;
  attachments?: Attachment[];
  input: TInput;
};

export type RouteUnion<R extends AnyEmailCatalog> = {
  [K in keyof R['emails'] & string]: {
    route: K;
    input: R extends EmailCatalog<any> ? InputOf<R, K> : unknown;
  };
}[keyof R['emails'] & string];

export type BeforeSendCtx<R extends AnyEmailCatalog> = RouteUnion<R> & {
  args: SendArgs<unknown>;
  ctx: unknown;
  messageId: string;
};

export type ExecuteCtx<R extends AnyEmailCatalog> = BeforeSendCtx<R> & {
  rendered: RenderedMessage;
};

export type AfterSendCtx<R extends AnyEmailCatalog> = BeforeSendCtx<R> & {
  result: SendResult;
  durationMs: number;
};

export type ErrorPhase = 'validate' | 'middleware' | 'render' | 'send' | 'hook';

export type ErrorCtx<R extends AnyEmailCatalog> = BeforeSendCtx<R> & {
  error: EmailRpcError;
  phase: ErrorPhase;
};

export type HookFn<T> = (params: T) => void | Promise<void>;

export type ClientHooks<R extends AnyEmailCatalog = AnyEmailCatalog> = {
  onBeforeSend?: HookFn<BeforeSendCtx<R>> | HookFn<BeforeSendCtx<R>>[];
  onExecute?: HookFn<ExecuteCtx<R>> | HookFn<ExecuteCtx<R>>[];
  onAfterSend?: HookFn<AfterSendCtx<R>> | HookFn<AfterSendCtx<R>>[];
  onError?: HookFn<ErrorCtx<R>> | HookFn<ErrorCtx<R>>[];
};

export type CreateClientOptions<R extends AnyEmailCatalog, P extends readonly TransportEntry[]> = {
  catalog: R;
  transports: P;
  ctx?: CtxOf<R>;
  defaults?: {
    from?: FromInput;
    replyTo?: Address;
    headers?: Record<string, string>;
  };
  hooks?: ClientHooks<R>;
  logger?: LoggerLike;
  plugins?: ReadonlyArray<Plugin<NoInfer<R>> | Plugin>;
};

export type SendOptions<P extends readonly TransportEntry[]> = {
  transport?: P[number]['name'];
};

export type RenderOptions<TCtx = unknown> = {
  format?: 'html' | 'text';
  ctx?: TCtx;
};

type RouteMethods<TInput, P extends readonly TransportEntry[]> = {
  send(args: SendArgs<TInput>, opts?: SendOptions<P>): Promise<SendResult>;
  render(input: TInput, opts?: { ctx?: unknown }): Promise<RenderedOutput>;
  render(input: TInput, opts: { format: 'html' | 'text'; ctx?: unknown }): Promise<string>;
};

type InputFromBuilder<B> = B extends EmailBuilder<any, infer S>
  ? S extends { input: infer TSchema }
    ? TSchema extends AnyStandardSchema
      ? InferOutput<TSchema>
      : unknown
    : unknown
  : unknown;

type ClientFromMap<M, P extends readonly TransportEntry[]> = {
  [K in keyof M]: M[K] extends AnyEmailCatalog
    ? ClientFromMap<M[K] extends EmailCatalog<infer SubM> ? SubM : never, P>
    : M[K] extends EmailBuilder<any, any>
      ? RouteMethods<InputFromBuilder<M[K]>, P>
      : RouteMethods<unknown, P>;
};

export type EmailClient<R extends AnyEmailCatalog, P extends readonly TransportEntry[]> =
  R extends EmailCatalog<infer M> ? ClientFromMap<M, P> : never;

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
  return typeof addr === 'string' ? addr : addr.email;
};

const fromInputToParts = (
  input: FromInput | undefined,
): { name: string | undefined; email: string | undefined } => {
  if (!input) return { name: undefined, email: undefined };
  if (typeof input === 'string') return { name: undefined, email: input };
  return { name: input.name, email: input.email };
};

const resolveFrom = (
  perEmail: FromInput | undefined,
  defaults: FromInput | undefined,
): Address | undefined => {
  const a = fromInputToParts(perEmail);
  const b = fromInputToParts(defaults);
  const email = a.email ?? b.email;
  if (!email) return undefined;
  const name = a.name ?? b.name;
  return name ? { name, email } : { email };
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
  transportsByName: Map<string, Transport>;
  defaultTransport: TransportEntry | undefined;
  defaults?: CreateClientOptions<AnyEmailCatalog, readonly TransportEntry[]>['defaults'];
  defaultCtx: unknown;
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
    const [err] = await handlePromise((async () => fn(params))());
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
        : new EmailRpcError({
            message: err.message,
            code: 'UNKNOWN',
            cause: err,
          }),
    phase: 'hook' as const,
  };
  for (const fn of hookErrorHandlers) {
    const [nestedErr] = await handlePromise((async () => fn(errorParams))());
    if (nestedErr) log.error('hook failed', { err: nestedErr, hook: 'onError' });
  }
};

const executeRender = async (
  def: EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown, unknown>>,
  rawInput: unknown,
  opts?: { format?: 'html' | 'text'; ctx?: unknown },
): Promise<RenderedOutput | string> => {
  const input = await validate(def.schema, rawInput, { route: def.id });
  const rendered = await def.template.render({ input, ctx: opts?.ctx ?? {} });

  if (!opts?.format) return rendered;

  if (opts.format === 'html') return rendered.html;
  return rendered.text ?? '';
};

const toAddressArray = (value: Address | Address[]): Address[] => {
  return Array.isArray(value) ? value : [value];
};

type SendCore = (currentCtx: unknown) => Promise<SendResult>;

const buildMessage = (
  def: EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown, unknown>>,
  args: RawSendArgs,
  input: unknown,
  rendered: { html: string; text?: string; subject?: string },
  ctx: SendPipelineContext,
  messageId: string,
): RenderedMessage => {
  const subject = resolveSubject(def.subject, input, rendered.subject);
  const fromAddr = resolveFrom(def.from, ctx.defaults?.from);
  if (!fromAddr) {
    throw new EmailRpcError({
      message: `No "from" email for route "${ctx.route}": set it on the email definition or in client defaults.`,
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
  args: RawSendArgs,
  route: string,
  messageId: string,
): ((ctx: unknown) => Promise<SendResult>) => {
  let chain: (ctx: unknown) => Promise<SendResult> = (ctx) => core(ctx);
  for (let i = middlewares.length - 1; i >= 0; i--) {
    const mw = middlewares[i];
    if (!mw) continue;
    const downstream = chain;
    chain = (currentCtx) =>
      mw({
        input: baseInput,
        ctx: currentCtx,
        route,
        messageId,
        args,
        next: (newCtx) =>
          downstream(newCtx ? { ...(currentCtx as object), ...newCtx } : currentCtx),
      });
  }
  return (ctx) => chain(ctx);
};

const pickTransport = (
  ctx: SendPipelineContext,
  opts: { transport?: string } | undefined,
  messageId: string,
): Transport => {
  if (opts?.transport) {
    const found = ctx.transportsByName.get(opts.transport);
    if (!found) {
      throw new EmailRpcError({
        message: `Transport "${opts.transport}" is not registered.`,
        code: 'PROVIDER',
        route: ctx.route,
        messageId,
      });
    }
    return found;
  }
  if (!ctx.defaultTransport) {
    throw new EmailRpcError({
      message: 'No transports registered.',
      code: 'PROVIDER',
      route: ctx.route,
      messageId,
    });
  }
  return ctx.defaultTransport.transport;
};

const executeSend = async (
  def: EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown, unknown>>,
  args: RawSendArgs,
  opts: { transport?: string } | undefined,
  ctx: SendPipelineContext,
): Promise<SendResult> => {
  const messageId = crypto.randomUUID();
  const log = ctx.logger.child({ route: ctx.route, messageId });
  log.debug('send start', { to: args.to, hasInput: args.input !== undefined });
  const startedAt = performance.now();
  const initialCtx: unknown = ctx.defaultCtx ?? {};
  const baseHookCtx = { route: ctx.route, args, ctx: initialCtx, messageId };

  const [validateErr, input] = await handlePromise(
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

  const renderState: { renderMs: number; sendMs: number } = {
    renderMs: 0,
    sendMs: 0,
  };

  const core: SendCore = async (currentCtx) => {
    log.debug('render start', {
      adapter: def.template?.constructor?.name ?? 'adapter',
    });
    const renderStart = performance.now();
    const renderTuple = await handlePromise(def.template.render({ input, ctx: currentCtx }));
    renderState.renderMs = performance.now() - renderStart;
    const renderErr = renderTuple[0];
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
        {
          ...beforeSendParams,
          ctx: currentCtx,
          error: wrapped,
          phase: 'render' as const,
        },
        (e) => reportHookError(ctx.normalizedHooks.onError, beforeSendParams, e, log, 'onError'),
      );
      markHandled(wrapped);
      throw wrapped;
    }
    const rendered = renderTuple[1];

    const message = buildMessage(def, args, input, rendered, ctx, messageId);

    const executeParams = {
      ...beforeSendParams,
      ctx: currentCtx,
      rendered: message,
    };
    const executeErr = await runHooks(ctx.normalizedHooks.onExecute, executeParams, (e) =>
      reportHookError(ctx.normalizedHooks.onError, executeParams, e, log, 'onExecute'),
    );
    if (executeErr) {
      markHandled(executeErr);
      throw executeErr;
    }

    const transport = pickTransport(ctx, opts, messageId);
    const sendContext: SendContext = {
      route: ctx.route,
      messageId,
      attempt: 1,
    };
    log.debug('transport send', { transportName: transport.name, attempt: 1 });
    const sendStart = performance.now();
    const sendTuple = await handlePromise(transport.send(message, sendContext));
    renderState.sendMs = performance.now() - sendStart;
    const sendErr = sendTuple[0];

    if (sendErr) {
      log.error('send failed', {
        err: sendErr,
        transportName: transport.name,
        durationMs: renderState.sendMs,
      });
      const wrapped =
        sendErr instanceof EmailRpcError
          ? sendErr
          : new EmailRpcError({
              message: `Transport send failed for route "${ctx.route}": ${sendErr.message}`,
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
    const transportResult = sendTuple[1];

    const result: SendResult = {
      messageId,
      providerMessageId: transportResult.transportMessageId,
      accepted: transportResult.accepted,
      rejected: transportResult.rejected,
      envelope: {
        from: normalizeAddress(message.from),
        to: message.to.map(normalizeAddress),
      },
      timing: { renderMs: renderState.renderMs, sendMs: renderState.sendMs },
    };
    log.info('send ok', {
      transportName: transport.name,
      durationMs: performance.now() - startedAt,
      transportMessageId: result.providerMessageId,
    });
    return result;
  };

  const allMiddleware = [...ctx.pluginMiddleware, ...def.middleware];
  const composed = composeMiddleware(
    allMiddleware,
    core,
    input,
    args,
    ctx.route,
    messageId,
  );

  const mwTuple = await handlePromise(composed(initialCtx));
  const mwErr = mwTuple[0];
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
  const result = mwTuple[1];

  const afterSendParams = {
    ...beforeSendParams,
    result,
    durationMs: renderState.renderMs + renderState.sendMs,
  };
  await runHooks(ctx.normalizedHooks.onAfterSend, afterSendParams, (e) =>
    reportHookError(ctx.normalizedHooks.onError, afterSendParams, e, log, 'onAfterSend'),
  );

  return result;
};

export const createClient = <R extends AnyEmailCatalog, const P extends readonly TransportEntry[]>(
  options: CreateClientOptions<R, P>,
): EmailClient<R, P> & { close: () => Promise<void> } => {
  const { catalog, transports } = options;
  const cache = new Map<string, unknown>();

  const sortedTransports = [...transports].sort((a, b) => a.priority - b.priority);
  const defaultTransport = sortedTransports[0];
  const transportsByName = new Map(transports.map((p) => [p.name, p.transport]));

  const plugins = options.plugins ?? [];
  const pluginMiddleware: AnyMiddleware[] = plugins.flatMap((p) => p.middleware ?? []);
  const baseLogger = (options.logger ?? consoleLogger()).child({
    component: 'client',
  });

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
    if (!plugin) continue;
    if (plugin.onCreate) plugin.onCreate({ catalog });
  }

  const close = async (): Promise<void> => {
    for (let i = plugins.length - 1; i >= 0; i--) {
      const plugin = plugins[i];
      if (!plugin) continue;
      if (plugin.onClose) {
        const onClose = plugin.onClose;
        const [err] = await handlePromise((async () => onClose())());
        if (err) baseLogger.error('plugin close failed', { err, plugin: plugin.name });
      }
    }
  };

  const buildProcMethods = (
    def: EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown, unknown>>,
    flatKey: string,
  ) =>
    Object.freeze({
      send: (sendArgs: RawSendArgs, sendOpts?: { transport?: string }) =>
        executeSend(def, sendArgs, sendOpts, {
          transportsByName,
          defaultTransport,
          defaults: options.defaults,
          defaultCtx: options.ctx,
          normalizedHooks,
          pluginMiddleware,
          logger: baseLogger,
          route: flatKey,
        }),
      render: (input: unknown, renderOpts?: { format?: 'html' | 'text'; ctx?: unknown }) =>
        executeRender(def, input, renderOpts),
    });

  const buildNestedProxy = (
    nestedNode: Record<string, unknown>,
    pathPrefix: string,
  ): unknown => {
    return new Proxy(
      {},
      {
        get(_t, key) {
          if (typeof key !== 'string') return undefined;
          const value = nestedNode[key];
          if (value === undefined) return undefined;
          const flatKey = pathPrefix ? `${pathPrefix}.${key}` : key;
          if (isEmailCatalog(value)) {
            return buildNestedProxy(value.nested as Record<string, unknown>, flatKey);
          }
          const def = catalog.emails[flatKey];
          if (!def) return undefined;
          const cached = cache.get(flatKey);
          if (cached) return cached;
          const methods = buildProcMethods(def, flatKey);
          cache.set(flatKey, methods);
          return methods;
        },
      },
    );
  };

  const target = { close } as { close: () => Promise<void> };
  const nestedProxy = buildNestedProxy(catalog.nested as Record<string, unknown>, '');
  const proxy = new Proxy(target as unknown as EmailClient<R, P> & { close: () => Promise<void> }, {
    get(t, key) {
      if (typeof key !== 'string') return undefined;
      if (key === 'close') return (t as { close: () => Promise<void> }).close;
      return (nestedProxy as Record<string, unknown>)[key];
    },
  });

  return proxy;
};
