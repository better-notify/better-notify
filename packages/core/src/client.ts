import { validate } from './schema.js';
import { NotifyRpcError } from './errors.js';
import type { AnyCatalog, CtxOf, ChannelsOf, Catalog } from './catalog.js';
import { isCatalog } from './catalog.js';
import type { Plugin } from './plugins/types.js';
import type { AnyMiddleware } from './middlewares/types.js';
import type { AnyChannel, ChannelDefinition, TransportsFor } from './channel/types.js';
import type { Transport, TransportOverrides } from './transport.js';
import { consoleLogger, type LoggerLike } from './logger.js';
import { handlePromise } from './lib/handle-promise.js';
import {
  runSendPipeline,
  normalizeHooks,
  type SendPipelineDeps,
  type ClientHooks,
  type ChannelSendResult,
} from './pipeline.js';
import type { QueueProducer, EnqueueOptions, JobEnvelope } from './queue/types.js';

export type CreateClientOptions<R extends AnyCatalog> = {
  catalog: R;
  /** @deprecated Channels are now inferred from the catalog. Only needed to override a channel at runtime. */
  channels?: Partial<ChannelsOf<R>>;
  transportsByChannel: Partial<TransportsFor<ChannelsOf<R>>>;
  ctx?: CtxOf<R>;
  hooks?: ClientHooks<R>;
  logger?: LoggerLike;
  plugins?: ReadonlyArray<Plugin<NoInfer<R>> | Plugin>;
  queue?: QueueProducer;
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

type TransportOverridesArg<TChannel extends string = string> = {
  transport?: TransportOverrides<TChannel>;
};

type SendArgTuple<T> = {} extends T ? [args?: T] : [args: T];

type ChannelRouteMethods<TArgs, TChannel extends string = string> = {
  send(...args: SendArgTuple<TArgs & TransportOverridesArg<TChannel>>): Promise<ChannelSendResult>;
  batch(
    entries: ReadonlyArray<TArgs & TransportOverridesArg<TChannel>>,
    opts?: BatchOptions,
  ): Promise<BatchResult<ChannelSendResult>>;
  queue(
    args: TArgs & TransportOverridesArg<TChannel>,
    opts?: EnqueueOptions,
  ): Promise<{ id: string }>;
  queueBatch(
    entries: ReadonlyArray<TArgs & TransportOverridesArg<TChannel>>,
    opts?: EnqueueOptions,
  ): Promise<BatchResult<{ id: string }>>;
  render(input: unknown, opts?: { ctx?: unknown }): Promise<unknown>;
};

type ArgsOfBuilder<B> = B extends { readonly _args: infer A } ? A : unknown;
type ChannelOfBuilder<B> = B extends { readonly _channel: infer C extends string } ? C : string;

type ClientFromMap<M> = {
  [K in keyof M]: M[K] extends AnyCatalog
    ? ClientFromMap<M[K] extends Catalog<infer SubM> ? SubM : never>
    : M[K] extends { readonly _channel: string }
      ? ChannelRouteMethods<ArgsOfBuilder<M[K]>, ChannelOfBuilder<M[K]>>
      : ChannelRouteMethods<unknown>;
};

export type Client<R extends AnyCatalog> = R extends Catalog<infer M> ? ClientFromMap<M> : never;

export const createClient = <R extends AnyCatalog>(
  options: CreateClientOptions<R>,
): Client<R> & { close: () => Promise<void> } => {
  const { catalog } = options;
  const channels = (options.channels ?? {}) as Record<string, AnyChannel>;
  const transportsByChannel = options.transportsByChannel as Record<
    string,
    Transport<unknown, unknown>
  >;
  const producer = options.queue;
  const cache = new Map<string, unknown>();

  const plugins = options.plugins ?? [];
  const baseLogger = (options.logger ?? consoleLogger()).child({ component: 'client' });
  const pluginMiddleware: AnyMiddleware[] = plugins.flatMap((p) => p?.middleware ?? []);
  const normalizedHooks = normalizeHooks([
    ...plugins.map((p) => p?.hooks as ClientHooks | undefined),
    options.hooks,
  ]);

  const deps: SendPipelineDeps = {
    channels,
    transportsByChannel,
    hooks: normalizedHooks,
    pluginMiddleware,
    logger: baseLogger,
  };

  const executeChannelSend = (
    channelDef: ChannelDefinition<unknown, unknown>,
    rawArgs: unknown,
    flatKey: string,
  ): Promise<ChannelSendResult> => runSendPipeline(deps, channelDef, rawArgs, flatKey, options.ctx);

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

  const buildProcMethods = (channelDef: ChannelDefinition<unknown, unknown>, flatKey: string) =>
    Object.freeze({
      send: (rawArgs?: unknown) => executeChannelSend(channelDef, rawArgs ?? {}, flatKey),
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
      queue: async (rawArgs: unknown, enqueueOpts?: EnqueueOptions) => {
        if (!producer) {
          throw new NotifyRpcError({
            message: `Channel "${channelDef.channel}" does not support queueing (no queue configured).`,
            code: 'CHANNEL_NOT_QUEUEABLE',
            route: flatKey,
          });
        }
        await validate(channelDef.schema, (rawArgs as { input?: unknown })?.input, {
          route: flatKey,
        });
        return producer.enqueue(
          {
            id: crypto.randomUUID(),
            route: flatKey,
            args: rawArgs,
            attempt: 0,
            enqueuedAt: new Date().toISOString(),
          },
          enqueueOpts,
        );
      },
      queueBatch: async (entries: ReadonlyArray<unknown>, enqueueOpts?: EnqueueOptions) => {
        if (!producer) {
          throw new NotifyRpcError({
            message: `Channel "${channelDef.channel}" does not support queueing (no queue configured).`,
            code: 'CHANNEL_NOT_QUEUEABLE',
            route: flatKey,
          });
        }
        if (entries.length === 0) {
          throw new NotifyRpcError({
            message: 'queueBatch requires at least one entry',
            code: 'BATCH_EMPTY',
            route: flatKey,
          });
        }
        const results: Array<
          | { status: 'ok'; index: number; result: { id: string } }
          | { status: 'error'; index: number; error: NotifyRpcError }
        > = [];
        const envelopes: JobEnvelope[] = [];
        let okCount = 0;
        let errorCount = 0;
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const [err] = await handlePromise(
            validate(channelDef.schema, (entry as { input?: unknown })?.input, { route: flatKey }),
          );
          if (err) {
            errorCount++;
            results.push({ status: 'error', index: i, error: err as NotifyRpcError });
            continue;
          }
          const envelope: JobEnvelope = {
            id: crypto.randomUUID(),
            route: flatKey,
            args: entry,
            attempt: 0,
            enqueuedAt: new Date().toISOString(),
          };
          envelopes.push(envelope);
          okCount++;
          results.push({ status: 'ok', index: i, result: { id: envelope.id } });
        }
        if (envelopes.length > 0) {
          if (producer.enqueueBatch) await producer.enqueueBatch(envelopes, enqueueOpts);
          else await Promise.all(envelopes.map((e) => producer.enqueue(e, enqueueOpts)));
        }
        return { okCount, errorCount, results };
      },
      render: async (input: unknown, renderOpts?: { ctx?: unknown }) => {
        const channel = channels[channelDef.channel] ?? channelDef.channelRef;
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
        get(_t, key: string) {
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
