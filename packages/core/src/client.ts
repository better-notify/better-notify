import { validate } from './schema.js';
import { NotifyRpcError } from './errors.js';
import type { AnyCatalog, CtxOf, Catalog, InputOf } from './catalog.js';
import { isCatalog } from './catalog.js';
import type { Plugin } from './plugins/types.js';
import type { AnyMiddleware } from './middlewares/types.js';
import type { AnyChannel, ChannelDefinition, ChannelMap, TransportsFor } from './channel/types.js';
import type { Transport, TransportResult } from './transport.js';
import { consoleLogger, type LoggerLike } from './logger.js';
import { handlePromise } from './lib/handle-promise.js';
import type {
  QueueAdapter,
  EnqueueOptions,
  EnqueueResult,
  EmailJobPayload,
} from './queue/types.js';

export type ChannelSendResult<TData = unknown> = {
  messageId: string;
  data: TData;
  envelope?: { from?: string; to: string[] };
  timing: { renderMs: number; sendMs: number };
};

export type SendArgs<TInput> = { input: TInput; [k: string]: unknown };

export type RouteUnion<R extends AnyCatalog> = {
  [K in keyof R['definitions'] & string]: {
    route: K;
    input: R extends Catalog<any> ? InputOf<R, K> : unknown;
  };
}[keyof R['definitions'] & string];

/**
 * Context passed to {@link ClientHooks.onBeforeSend | `onBeforeSend`} hooks.
 * Available on every hook type as the base set of fields.
 */
export type BeforeSendCtx<R extends AnyCatalog> = RouteUnion<R> & {
  /** Full send arguments (includes `input` plus channel-specific fields). */
  args: SendArgs<unknown>;
  /** Context object at the time the hook fires. */
  ctx: unknown;
  /** UUID assigned to this individual send attempt. */
  messageId: string;
};

/**
 * Context passed to {@link ClientHooks.onExecute | `onExecute`} hooks.
 * Fires after a successful render, before the transport send.
 */
export type ExecuteCtx<R extends AnyCatalog> = BeforeSendCtx<R> & {
  /** The rendered output produced by the template adapter. */
  rendered: unknown;
};

/**
 * Context passed to {@link ClientHooks.onAfterSend | `onAfterSend`} hooks.
 * Fires only on a successful send.
 */
export type AfterSendCtx<R extends AnyCatalog> = BeforeSendCtx<R> & {
  /** The result returned by the transport. */
  result: ChannelSendResult<unknown>;
  /** Combined render + send duration in milliseconds. */
  durationMs: number;
};

/**
 * The stage of the send pipeline where an error originated.
 *
 * | Phase        | When it fires                                                          |
 * | ------------ | ---------------------------------------------------------------------- |
 * | `validate`   | Input fails the schema declared with `.input()`                        |
 * | `middleware` | A middleware throws (or calls `next` which throws) outside render/send |
 * | `render`     | The template adapter throws during `render()`                          |
 * | `send`       | The transport throws or returns `{ ok: false }`                        |
 * | `hook`       | A lifecycle hook (`onBeforeSend`, `onExecute`, `onAfterSend`) throws   |
 */
export type ErrorPhase = 'validate' | 'middleware' | 'render' | 'send' | 'hook';

/**
 * Context passed to {@link ClientHooks.onError | `onError`} hooks.
 * Fires on any error regardless of phase; use `phase` to distinguish sources.
 */
export type ErrorCtx<R extends AnyCatalog> = BeforeSendCtx<R> & {
  /** The `NotifyRpcError` that triggered this hook (always a `NotifyRpcError`). */
  error: NotifyRpcError;
  /** Pipeline stage where the error originated — see {@link ErrorPhase}. */
  phase: ErrorPhase;
};

/** A lifecycle hook handler. May be async; failures are isolated and reported via `onError`. */
export type HookFn<T> = (params: T) => void | Promise<void>;

/**
 * Lifecycle hooks for a {@link createClient} instance.
 *
 * Hooks observe the pipeline but cannot short-circuit the pipeline with a
 * successful synthetic result — use middleware for that. Each hook accepts a single handler or an array of
 * handlers executed in order.
 *
 * Execution order per send:
 * 1. `onBeforeSend` — after validation, before the middleware chain
 * 2. `onExecute` — after render succeeds, before transport send
 * 3. `onAfterSend` — after a successful transport send
 * 4. `onError` — whenever any phase throws; also called if another hook throws
 *
 * Hook failures are logged and routed to `onError` (with `phase: 'hook'`).
 * A failing hook does not stop other hooks in the same array from running.
 */
export type ClientHooks<R extends AnyCatalog = AnyCatalog> = {
  /** Fires after validation passes, before the middleware chain. */
  onBeforeSend?: HookFn<BeforeSendCtx<R>> | HookFn<BeforeSendCtx<R>>[];
  /** Fires after render succeeds, before the transport send. */
  onExecute?: HookFn<ExecuteCtx<R>> | HookFn<ExecuteCtx<R>>[];
  /** Fires after a successful transport send. Not called on error. */
  onAfterSend?: HookFn<AfterSendCtx<R>> | HookFn<AfterSendCtx<R>>[];
  /** Fires on any pipeline error regardless of phase. Also fires when another hook throws. */
  onError?: HookFn<ErrorCtx<R>> | HookFn<ErrorCtx<R>>[];
};

export type CreateClientOptions<R extends AnyCatalog, Channels extends ChannelMap = ChannelMap> = {
  catalog: R;
  channels: Channels;
  transportsByChannel: Partial<TransportsFor<Channels>>;
  /** Queue adapter enabling `.queue()` on route methods. Omitting it leaves `.queue()` throwing CHANNEL_NOT_QUEUEABLE. */
  queue?: QueueAdapter;
  ctx?: CtxOf<R>;
  hooks?: ClientHooks<R>;
  logger?: LoggerLike;
  plugins?: ReadonlyArray<Plugin<NoInfer<R>> | Plugin>;
};

export type SendOptions = Record<string, unknown>;
export type RenderOptions<TCtx = unknown> = { format?: 'html' | 'text'; ctx?: TCtx };

type BatchEntryResult<TResult> =
  | { status: 'ok'; index: number; result: TResult }
  | { status: 'error'; index: number; error: NotifyRpcError };

type BatchResult<TResult> = {
  okCount: number;
  errorCount: number;
  results: ReadonlyArray<BatchEntryResult<TResult>>;
};

type BatchOptions = { interval?: number };

type ChannelRouteMethods<TArgs> = {
  send(args: TArgs): Promise<ChannelSendResult>;
  batch(
    entries: ReadonlyArray<TArgs>,
    opts?: BatchOptions,
  ): Promise<BatchResult<ChannelSendResult>>;
  queue(args: TArgs, opts?: EnqueueOptions): Promise<EnqueueResult>;
  render(input: unknown, opts?: { ctx?: unknown }): Promise<unknown>;
};

type ArgsOfBuilder<B> = B extends { readonly _args: infer A } ? A : unknown;

type ClientFromMap<M> = {
  [K in keyof M]: M[K] extends AnyCatalog
    ? ClientFromMap<M[K] extends Catalog<infer SubM> ? SubM : never>
    : M[K] extends { readonly _channel: string }
      ? ChannelRouteMethods<ArgsOfBuilder<M[K]>>
      : ChannelRouteMethods<unknown>;
};

export type Client<R extends AnyCatalog> = R extends Catalog<infer M> ? ClientFromMap<M> : never;

const HANDLED = Symbol.for('notifyrpc.error.handled');

const markHandled = (err: unknown): void => {
  if (err && typeof err === 'object') (err as Record<symbol, true>)[HANDLED] = true;
};

const isHandled = (err: unknown): boolean => {
  return !!(err && typeof err === 'object' && (err as Record<symbol, unknown>)[HANDLED]);
};

const toEmailString = (addr: unknown): string => {
  if (typeof addr === 'string') return addr;
  if (addr && typeof addr === 'object' && 'email' in addr) {
    return String((addr as { email: unknown }).email);
  }
  return '';
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
      err instanceof NotifyRpcError
        ? err
        : new NotifyRpcError({ message: err.message, code: 'UNKNOWN', cause: err }),
    phase: 'hook' as const,
  };
  for (const fn of hookErrorHandlers) {
    const [nestedErr] = await handlePromise((async () => fn(errorParams))());
    if (nestedErr) log.error('hook failed', { err: nestedErr, hook: 'onError' });
  }
};

type SendCore = (currentCtx: unknown) => Promise<ChannelSendResult>;

const composeMiddleware = (
  middlewares: ReadonlyArray<AnyMiddleware>,
  core: SendCore,
  baseInput: unknown,
  args: Record<string, unknown>,
  route: string,
  messageId: string,
): ((ctx: unknown) => Promise<ChannelSendResult>) => {
  let chain: (ctx: unknown) => Promise<ChannelSendResult> = (ctx) => core(ctx);
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
        args: args as never,
        next: ((newCtx?: Record<string, unknown>) =>
          downstream(newCtx ? { ...(currentCtx as object), ...newCtx } : currentCtx)) as never,
      }) as unknown as Promise<ChannelSendResult>;
  }
  return (ctx) => chain(ctx);
};

export const createClient = <R extends AnyCatalog, Channels extends ChannelMap = ChannelMap>(
  options: CreateClientOptions<R, Channels>,
): Client<R> & { close: () => Promise<void> } => {
  const { catalog } = options;
  const channels = options.channels as Record<string, AnyChannel>;
  const transportsByChannel = options.transportsByChannel as Record<
    string,
    Transport<unknown, unknown>
  >;
  const cache = new Map<string, unknown>();

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
    if (!plugin) continue;
    if (plugin.onCreate) plugin.onCreate({ catalog });
  }

  const close = async (): Promise<void> => {
    if (options.queue) {
      const [err] = await handlePromise(options.queue.close());
      if (err) baseLogger.error('queue adapter close failed', { err });
    }
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

  const executeChannelSend = async (
    channelDef: ChannelDefinition<unknown, unknown>,
    rawArgs: unknown,
    flatKey: string,
  ): Promise<ChannelSendResult> => {
    const channel = channels[channelDef.channel];
    if (!channel) {
      throw new NotifyRpcError({
        message: `No channel registered for "${channelDef.channel}".`,
        code: 'CONFIG',
        route: flatKey,
      });
    }
    const transport = transportsByChannel[channelDef.channel];
    if (!transport) {
      throw new NotifyRpcError({
        message: `No transport registered for channel "${channelDef.channel}".`,
        code: 'PROVIDER',
        route: flatKey,
      });
    }

    const messageId = crypto.randomUUID();
    const log = baseLogger.child({ route: flatKey, messageId });
    const startedAt = performance.now();
    const initialCtx: unknown = options.ctx ?? {};
    const args = await channel.validateArgs(rawArgs);
    const baseHookCtx = { route: flatKey, args, ctx: initialCtx, messageId };

    const [validateErr, input] = await handlePromise(
      validate(channelDef.schema, (rawArgs as { input?: unknown })?.input, { route: flatKey }),
    );
    if (validateErr) {
      log.warn('validate failed', { err: validateErr });
      await runHooks(
        normalizedHooks.onError,
        {
          ...baseHookCtx,
          input: undefined,
          error: validateErr as NotifyRpcError,
          phase: 'validate' as const,
        },
        (e) => reportHookError(normalizedHooks.onError, baseHookCtx, e, log, 'onError'),
      );
      markHandled(validateErr);
      throw validateErr;
    }

    const beforeSendParams = { ...baseHookCtx, input };
    const beforeErr = await runHooks(normalizedHooks.onBeforeSend, beforeSendParams, (e) =>
      reportHookError(normalizedHooks.onError, beforeSendParams, e, log, 'onBeforeSend'),
    );
    if (beforeErr) {
      markHandled(beforeErr);
      throw beforeErr;
    }

    const timing = { renderMs: 0, sendMs: 0 };
    const argsWithInput = { ...(args as object), input } as Record<string, unknown>;

    const core: SendCore = async (currentCtx) => {
      const renderStart = performance.now();
      const renderTuple = await handlePromise(
        channel.render(channelDef as never, argsWithInput as never, currentCtx),
      );
      timing.renderMs = performance.now() - renderStart;
      const renderErr = renderTuple[0];
      if (renderErr) {
        const wrapped = new NotifyRpcError({
          message: `Render failed for route "${flatKey}": ${renderErr.message}`,
          code: 'RENDER',
          route: flatKey,
          messageId,
          cause: renderErr,
        });
        await runHooks(
          normalizedHooks.onError,
          { ...beforeSendParams, ctx: currentCtx, error: wrapped, phase: 'render' as const },
          (e) => reportHookError(normalizedHooks.onError, beforeSendParams, e, log, 'onError'),
        );
        markHandled(wrapped);
        throw wrapped;
      }
      const rendered = renderTuple[1];

      const executeParams = { ...beforeSendParams, ctx: currentCtx, rendered };
      const executeErr = await runHooks(normalizedHooks.onExecute, executeParams, (e) =>
        reportHookError(normalizedHooks.onError, executeParams, e, log, 'onExecute'),
      );
      if (executeErr) {
        markHandled(executeErr);
        throw executeErr;
      }

      const sendStart = performance.now();
      const sendCtx = { route: flatKey, messageId, attempt: 1 };
      const sendTuple = await handlePromise(transport.send(rendered, sendCtx));
      timing.sendMs = performance.now() - sendStart;
      const sendThrow = sendTuple[0];
      const sendReturn = sendTuple[1];
      const failure: Error | null = sendThrow
        ? sendThrow
        : sendReturn && sendReturn.ok === false
          ? sendReturn.error
          : null;
      if (failure) {
        log.error('send failed', { err: failure, durationMs: timing.sendMs });
        const wrapped =
          failure instanceof NotifyRpcError
            ? failure
            : new NotifyRpcError({
                message: `Transport send failed for route "${flatKey}": ${failure.message}`,
                code: 'PROVIDER',
                route: flatKey,
                messageId,
                cause: failure,
              });
        await runHooks(
          normalizedHooks.onError,
          { ...executeParams, error: wrapped, phase: 'send' as const },
          (e) => reportHookError(normalizedHooks.onError, executeParams, e, log, 'onError'),
        );
        markHandled(wrapped);
        throw wrapped;
      }
      const data = (sendReturn as TransportResult<unknown> & { ok: true }).data;

      const renderedAny = rendered as Record<string, unknown> | undefined;
      const renderedFrom = renderedAny?.from;
      const renderedToRaw = renderedAny?.to;
      const renderedTo = Array.isArray(renderedToRaw) ? renderedToRaw : undefined;
      const envelope =
        renderedFrom && renderedTo
          ? {
              from: toEmailString(renderedFrom),
              to: renderedTo.map(toEmailString),
            }
          : undefined;
      const result: ChannelSendResult = {
        messageId,
        data,
        timing,
      };
      if (envelope) result.envelope = envelope;
      log.info('send ok', {
        durationMs: performance.now() - startedAt,
      });
      return result;
    };

    const allMiddleware = [...pluginMiddleware, ...channelDef.middleware];
    const composed = composeMiddleware(
      allMiddleware,
      core,
      input,
      argsWithInput,
      flatKey,
      messageId,
    );

    const mwTuple = await handlePromise(composed(initialCtx));
    const mwErr = mwTuple[0];
    if (mwErr) {
      if (isHandled(mwErr)) throw mwErr;
      const wrapped =
        mwErr instanceof NotifyRpcError
          ? mwErr
          : new NotifyRpcError({
              message: `Middleware failed for route "${flatKey}": ${mwErr.message}`,
              code: 'UNKNOWN',
              route: flatKey,
              messageId,
              cause: mwErr,
            });
      await runHooks(
        normalizedHooks.onError,
        { ...beforeSendParams, error: wrapped, phase: 'middleware' as const },
        (e) => reportHookError(normalizedHooks.onError, beforeSendParams, e, log, 'onError'),
      );
      markHandled(wrapped);
      throw wrapped;
    }
    const result = mwTuple[1];

    const afterSendParams = {
      ...beforeSendParams,
      result,
      durationMs: timing.renderMs + timing.sendMs,
    };
    await runHooks(normalizedHooks.onAfterSend, afterSendParams, (e) =>
      reportHookError(normalizedHooks.onError, afterSendParams, e, log, 'onAfterSend'),
    );
    return result;
  };

  const buildProcMethods = (channelDef: ChannelDefinition<unknown, unknown>, flatKey: string) =>
    Object.freeze({
      send: (rawArgs: unknown) => executeChannelSend(channelDef, rawArgs, flatKey),
      batch: async (entries: ReadonlyArray<unknown>, batchOpts?: BatchOptions) => {
        if (entries.length === 0) {
          throw new NotifyRpcError({
            message: 'batch requires at least one entry',
            code: 'BATCH_EMPTY',
            route: flatKey,
          });
        }
        const results: Array<
          | { status: 'ok'; index: number; result: ChannelSendResult }
          | { status: 'error'; index: number; error: NotifyRpcError }
        > = [];
        let okCount = 0;
        let errorCount = 0;
        const interval = batchOpts?.interval ?? 0;
        for (let i = 0; i < entries.length; i++) {
          const [err, res] = await handlePromise(
            executeChannelSend(channelDef, entries[i], flatKey),
          );
          if (err) {
            errorCount++;
            results.push({
              status: 'error',
              index: i,
              error:
                err instanceof NotifyRpcError
                  ? err
                  : new NotifyRpcError({ message: err.message, cause: err, route: flatKey }),
            });
          } else {
            okCount++;
            results.push({ status: 'ok', index: i, result: res });
          }
          if (interval > 0 && i < entries.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, interval));
          }
        }
        return { okCount, errorCount, results };
      },
      queue: async (rawArgs: unknown, queueOpts?: EnqueueOptions): Promise<EnqueueResult> => {
        if (!options.queue) {
          throw new NotifyRpcError({
            message: `No queue adapter configured. Pass queue: adapter to createClient().`,
            code: 'CHANNEL_NOT_QUEUEABLE',
            route: flatKey,
          });
        }
        const messageId = crypto.randomUUID();
        const [validateErr, input] = await handlePromise(
          validate(channelDef.schema, (rawArgs as { input?: unknown })?.input, { route: flatKey }),
        );
        if (validateErr) throw validateErr;
        const payload: EmailJobPayload = { _v: 1, route: flatKey, input, messageId };
        return options.queue.enqueue(payload, queueOpts);
      },
      render: async (input: unknown, renderOpts?: { ctx?: unknown }) => {
        const channel = channels[channelDef.channel];
        if (!channel?.previewRender) {
          throw new NotifyRpcError({
            message: `Channel "${channelDef.channel}" does not support .render().`,
            code: 'CONFIG',
            route: flatKey,
          });
        }
        const validated = await validate(channelDef.schema, input, { route: flatKey });
        return channel.previewRender(channelDef as never, validated, renderOpts?.ctx ?? {});
      },
    });

  const buildNestedProxy = (nestedNode: Record<string, unknown>, pathPrefix: string): unknown => {
    return new Proxy(
      {},
      {
        get(_t, key) {
          if (typeof key !== 'string') return undefined;
          const value = nestedNode[key];
          if (value === undefined) return undefined;
          const flatKey = pathPrefix ? `${pathPrefix}.${key}` : key;
          if (isCatalog(value)) {
            return buildNestedProxy(value.nested as Record<string, unknown>, flatKey);
          }
          const cached = cache.get(flatKey);
          if (cached) return cached;
          const channelDef = catalog.definitions?.[flatKey];
          if (channelDef) {
            const methods = buildProcMethods(channelDef, flatKey);
            cache.set(flatKey, methods);
            return methods;
          }
          return undefined;
        },
      },
    );
  };

  const target = { close } as { close: () => Promise<void> };
  const nestedProxy = buildNestedProxy(catalog.nested as Record<string, unknown>, '');
  const proxy = new Proxy(target as unknown as Client<R> & { close: () => Promise<void> }, {
    get(t, key) {
      if (typeof key !== 'string') return undefined;
      if (key === 'close') return (t as { close: () => Promise<void> }).close;
      return (nestedProxy as Record<string, unknown>)[key];
    },
  });

  return proxy;
};
