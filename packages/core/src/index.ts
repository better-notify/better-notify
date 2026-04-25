export { emailRpc } from './init.js'
export type {
  RootBuilder,
  InitOptions,
  InitHooks,
  EmailRpc,
} from './init.js'

export { EmailBuilder } from './builder.js'
export type {
  AnyEmailBuilder,
  CompleteEmailBuilder,
  EmailDefinition,
  EmailDefinitionOf,
  IsComplete,
  SubjectResolver,
} from './builder.js'

export { createRouter } from './router.js'
export type {
  EmailRouter,
  AnyEmailRouter,
  RouterMap,
  ValidateRouter,
  InputOf,
  OutputOf,
} from './router.js'

export { validate } from './schema.js'
export type {
  AnyStandardSchema,
  InferInput,
  InferOutput,
} from './schema.js'

export type { TemplateAdapter, RenderedOutput, AnyTemplateAdapter } from './template.js'

export {
  EmailRpcError,
  EmailRpcValidationError,
  EmailRpcNotImplementedError,
} from './errors.js'
export type { ErrorCode, EmailRpcErrorOptions, EmailRpcValidationErrorOptions } from './errors.js'

export type {
  Address,
  Attachment,
  InlineAsset,
  Priority,
  QueueResult,
  RenderedMessage,
  SendContext,
  SendResult,
  Tags,
} from './types.js'
