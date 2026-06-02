import { validate } from './schema.js';
import { NotifyRpcError } from './errors.js';
import type { AnyCatalog, Catalog, InputOf } from './catalog.js';
import type { AnyMiddleware } from './middlewares/types.js';
import type { AnyChannel, ChannelDefinition } from './channel/types.js';
import type { Transport, TransportResult, SendContext } from './transport.js';
import { type LoggerLike } from './logger.js';
import { handlePromise } from './lib/handle-promise.js';

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

export type NormalizedHooks = {
  onBeforeSend: HookFn<any>[];
  onExecute: HookFn<any>[];
  onAfterSend: HookFn<any>[];
  onError: HookFn<any>[];
};

const HANDLED = Symbol.for('notifyrpc.error.handled');

const markHandled = (err: unknown): void => {
  if (err && typeof err === 'object') (err as Record<symbol, true>)[HANDLED] = true;
};

const isHandled = (err: unknown): boolean =>
  !!(err && typeof err === 'object' && (err as Record<symbol, unknown>)[HANDLED]);

const toEmailString = (addr: unknown): string => {
  if (typeof addr === 'string') return addr;
  if (addr && typeof addr === 'object' && 'email' in addr) {
    return String((addr as { email: unknown }).email);
  }
  return '';
};

const toArray = <T>(v: T | T[] | undefined): T[] => {
  if (v === undefined) return [];
  if (Array.isArray(v)) return v;
  return [v];
};

export const normalizeHooks = (
  sources: ReadonlyArray<ClientHooks<any> | undefined>,
): NormalizedHooks => ({
  onBeforeSend: sources.flatMap((s) => toArray(s?.onBeforeSend as any)),
  onExecute: sources.flatMap((s) => toArray(s?.onExecute as any)),
  onAfterSend: sources.flatMap((s) => toArray(s?.onAfterSend as any)),
  onError: sources.flatMap((s) => toArray(s?.onError as any)),
});

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

export type SendPipelineDeps = {
  channels: Record<string, AnyChannel>;
  transportsByChannel: Record<string, Transport<unknown, unknown>>;
  hooks: NormalizedHooks;
  pluginMiddleware: AnyMiddleware[];
  logger: LoggerLike;
};

export const runSendPipeline = async (
  deps: SendPipelineDeps,
  channelDef: ChannelDefinition<unknown, unknown>,
  rawArgs: unknown,
  flatKey: string,
  ctx: unknown,
  attempt: number = 1,
): Promise<ChannelSendResult> => {
  const channel = deps.channels[channelDef.channel] ?? channelDef.channelRef;
  if (!channel) {
    throw new NotifyRpcError({
      message: `No channel registered for "${channelDef.channel}".`,
      code: 'CONFIG',
      route: flatKey,
    });
  }
  const transport = deps.transportsByChannel[channelDef.channel];
  if (!transport) {
    throw new NotifyRpcError({
      message: `No transport registered for channel "${channelDef.channel}".`,
      code: 'PROVIDER',
      route: flatKey,
    });
  }

  const messageId = crypto.randomUUID();
  const log = deps.logger.child({ route: flatKey, messageId });
  const startedAt = performance.now();
  const initialCtx: unknown = ctx ?? {};
  const args = await channel.validateArgs(rawArgs);
  const baseHookCtx = { route: flatKey, args, ctx: initialCtx, messageId };

  const [validateErr, input] = await handlePromise(
    validate(channelDef.schema, (rawArgs as { input?: unknown })?.input, { route: flatKey }),
  );
  if (validateErr) {
    log.warn('validate failed', { err: validateErr });
    await runHooks(
      deps.hooks.onError,
      {
        ...baseHookCtx,
        input: undefined,
        error: validateErr as NotifyRpcError,
        phase: 'validate' as const,
      },
      (e) => reportHookError(deps.hooks.onError, baseHookCtx, e, log, 'onError'),
    );
    markHandled(validateErr);
    throw validateErr;
  }

  const beforeSendParams = { ...baseHookCtx, input };
  const beforeErr = await runHooks(deps.hooks.onBeforeSend, beforeSendParams, (e) =>
    reportHookError(deps.hooks.onError, beforeSendParams, e, log, 'onBeforeSend'),
  );
  if (beforeErr) {
    const wrapped =
      beforeErr instanceof NotifyRpcError
        ? beforeErr
        : new NotifyRpcError({
            message: beforeErr.message,
            code: 'UNKNOWN',
            route: flatKey,
            messageId,
            cause: beforeErr,
          });
    markHandled(wrapped);
    throw wrapped;
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
        deps.hooks.onError,
        { ...beforeSendParams, ctx: currentCtx, error: wrapped, phase: 'render' as const },
        (e) => reportHookError(deps.hooks.onError, beforeSendParams, e, log, 'onError'),
      );
      markHandled(wrapped);
      throw wrapped;
    }
    const rendered = renderTuple[1];

    const executeParams = { ...beforeSendParams, ctx: currentCtx, rendered };
    const executeErr = await runHooks(deps.hooks.onExecute, executeParams, (e) =>
      reportHookError(deps.hooks.onError, executeParams, e, log, 'onExecute'),
    );
    if (executeErr) {
      const wrapped =
        executeErr instanceof NotifyRpcError
          ? executeErr
          : new NotifyRpcError({
              message: executeErr.message,
              code: 'UNKNOWN',
              route: flatKey,
              messageId,
              cause: executeErr,
            });
      markHandled(wrapped);
      throw wrapped;
    }

    const sendStart = performance.now();
    const transportData = (argsWithInput as { transport?: Record<string, Record<string, unknown>> })
      .transport;
    const sendCtx: SendContext = {
      route: flatKey,
      messageId,
      attempt,
      ...(transportData && { transport: transportData }),
    };
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
        deps.hooks.onError,
        { ...executeParams, error: wrapped, phase: 'send' as const },
        (e) => reportHookError(deps.hooks.onError, executeParams, e, log, 'onError'),
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
        ? { from: toEmailString(renderedFrom), to: renderedTo.map(toEmailString) }
        : undefined;
    const result: ChannelSendResult = { messageId, data, timing };
    if (envelope) result.envelope = envelope;
    log.info('send ok', { durationMs: performance.now() - startedAt });
    return result;
  };

  const allMiddleware = [...deps.pluginMiddleware, ...channelDef.middleware];
  const composed = composeMiddleware(allMiddleware, core, input, argsWithInput, flatKey, messageId);

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
      deps.hooks.onError,
      { ...beforeSendParams, error: wrapped, phase: 'middleware' as const },
      (e) => reportHookError(deps.hooks.onError, beforeSendParams, e, log, 'onError'),
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
  await runHooks(deps.hooks.onAfterSend, afterSendParams, (e) =>
    reportHookError(deps.hooks.onError, afterSendParams, e, log, 'onAfterSend'),
  );
  return result;
};
