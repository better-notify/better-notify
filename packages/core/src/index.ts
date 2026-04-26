export { createEmailRpc } from './factory.js';
export type { RootBuilder } from './factory.js';

export { EmailBuilder } from './builder.js';
export type {
  AnyEmailBuilder,
  CompleteEmailBuilder,
  EmailDefinition,
  EmailDefinitionOf,
  IsComplete,
  SubjectResolver,
} from './builder.js';

export { createCatalog, isEmailCatalog } from './catalog.js';
export type {
  EmailCatalog,
  AnyEmailCatalog,
  CatalogMap,
  ValidateCatalog,
  InputOf,
  OutputOf,
  CtxOf,
} from './catalog.js';

export { createClient } from './client.js';
export { handlePromise } from './lib/handle-promise.js';
export { sleep } from './lib/sleep.js';
export type {
  ClientHooks,
  CreateClientOptions,
  SendOptions,
  SendArgs,
  RenderOptions,
  EmailClient,
  HookFn,
  RouteUnion,
  BeforeSendCtx,
  ExecuteCtx,
  AfterSendCtx,
  ErrorCtx,
  ErrorPhase,
} from './client.js';

export type { Plugin } from './plugins/index.js';

export { multiTransport, createTransport } from './transports/index.js';
export type {
  Transport,
  TransportResult,
  TransportEntry,
  MultiTransportOptions,
  MultiTransportEntry,
  CreateTransportOptions,
} from './transports/index.js';

export {
  withDryRun,
  withTagInject,
  withEventLogger,
  withSuppressionList,
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
  WithSuppressionListOptions,
  SuppressionField,
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

export type { TemplateAdapter, RenderedOutput, AnyTemplateAdapter } from './template.js';

export {
  EmailRpcError,
  EmailRpcValidationError,
  EmailRpcRateLimitedError,
  EmailRpcNotImplementedError,
} from './errors.js';
export type {
  ErrorCode,
  EmailRpcErrorOptions,
  EmailRpcValidationErrorOptions,
  EmailRpcRateLimitedErrorOptions,
} from './errors.js';

export type {
  Address,
  FromInput,
  Attachment,
  InlineAsset,
  Priority,
  QueueResult,
  RawSendArgs,
  RenderedMessage,
  SendContext,
  SendResult,
  Tags,
} from './types.js';

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
  EmailEvent,
  EmailEventStatus,
  EmailEventError,
  EventSink,
  InMemoryEventSink,
  ConsoleEventSinkOptions,
  CreateEventSinkOptions,
} from './sinks/index.js';
export {
  createEventSink,
  inMemoryEventSink,
  consoleEventSink,
} from './sinks/index.js';

export type {
  SpanLike,
  SpanStatus,
  SpanStatusCode,
  TracerLike,
  InMemoryTracer,
  RecordedSpan,
} from './tracers/index.js';
export { inMemoryTracer } from './tracers/index.js';
