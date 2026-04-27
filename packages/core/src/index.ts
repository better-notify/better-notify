export { createCatalog, isCatalog } from './catalog.js';
export type {
  Catalog,
  AnyCatalog,
  CatalogMap,
  ValidateCatalog,
  InputOf,
  OutputOf,
  CtxOf,
} from './catalog.js';

export { createClient } from './client.js';
export { handlePromise } from './lib/handle-promise.js';
export { waitFor } from './lib/wait-for.js';
export { obscureString } from './lib/obscure-string.js';
export { obscureEmail } from './lib/obscure-email.js';
export type {
  ClientHooks,
  CreateClientOptions,
  SendOptions,
  SendArgs,
  RenderOptions,
  Client,
  HookFn,
  RouteUnion,
  BeforeSendCtx,
  ExecuteCtx,
  AfterSendCtx,
  ErrorCtx,
  ErrorPhase,
  ChannelSendResult,
} from './client.js';

export type { Plugin } from './plugins/index.js';

export type { Transport, TransportResult, AnyTransport, SendContext } from './transport.js';

export {
  multiTransport,
  createTransport,
  createMockTransport,
  mapTransport,
} from './transports/index.js';
export type {
  TransportEntry,
  MultiTransportOptions,
  MultiTransportEntry,
  MultiTransportBackoff,
  MultiTransportStrategy,
  CreateTransportOptions,
  CreateMockTransportOptions,
  MockTransport,
  MapTransportFn,
} from './transports/index.js';

export {
  withDryRun,
  withTagInject,
  withEventLogger,
  withRateLimit,
  withIdempotency,
  withTracing,
} from './middlewares/index.js';
export type {
  Middleware,
  AnyMiddleware,
  MiddlewareParams,
  WithTagInjectOptions,
  WithEventLoggerOptions,
  WithRateLimitOptions,
  RateLimitKey,
  RateLimitKeyParams,
  WithIdempotencyOptions,
  IdempotencyKey,
  IdempotencyKeyParams,
  WithTracingOptions,
  TracingNameParams,
} from './middlewares/index.js';

export { consoleLogger, fromPino } from './logger.js';
export type { LoggerLike, LogLevel, ConsoleLoggerOptions } from './logger.js';

export { validate } from './schema.js';
export type { AnyStandardSchema, InferInput, InferOutput } from './schema.js';

export {
  NotifyRpcError,
  NotifyRpcValidationError,
  NotifyRpcRateLimitedError,
  NotifyRpcNotImplementedError,
} from './errors.js';
export type {
  ErrorCode,
  NotifyRpcErrorOptions,
  NotifyRpcValidationErrorOptions,
  NotifyRpcRateLimitedErrorOptions,
} from './errors.js';

export type { Priority, Tags } from './types.js';

export type {
  SuppressionEntry,
  SuppressionList,
  RateLimitAlgorithm,
  RateLimitRecord,
  RateLimitStore,
  IdempotencyStore,
} from './stores/types.js';
export {
  createSuppressionList,
  createIdempotencyStore,
  inMemorySuppressionList,
  inMemoryRateLimitStore,
  inMemoryIdempotencyStore,
} from './stores/index.js';
export type {
  CreateSuppressionListOptions,
  CreateIdempotencyStoreOptions,
  InMemorySuppressionListOptions,
} from './stores/index.js';

export type {
  SendEvent,
  SendEventStatus,
  SendEventError,
  EventSink,
  InMemoryEventSink,
  ConsoleEventSinkOptions,
  CreateEventSinkOptions,
} from './sinks/index.js';
export { createEventSink, inMemoryEventSink, consoleEventSink } from './sinks/index.js';

export type {
  SpanLike,
  SpanStatus,
  SpanStatusCode,
  TracerLike,
  InMemoryTracer,
  RecordedSpan,
} from './tracers/index.js';
export { inMemoryTracer } from './tracers/index.js';

export type {
  Channel,
  ChannelDefinition,
  ChannelBuilderCtx,
  AnyChannel,
  ChannelMap,
  TransportsFor,
  ArgsFor,
  RenderedFor,
  BuilderFor,
} from './channel/types.js';

export { defineChannel, slot } from './channel/define-channel.js';
export type {
  DefineChannelOptions,
  ChannelBuilder,
  ResolverSlot,
  SlotKind,
  SlotConfig,
  SlotMap,
} from './channel/define-channel.js';

export { createNotify } from './notify.js';
export type { RootBuilder as NotifyRootBuilder, CreateNotifyOptions } from './notify.js';
