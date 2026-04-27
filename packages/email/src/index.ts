export type {
  Address,
  FromInput,
  Attachment,
  InlineAsset,
  RawSendArgs,
  RenderedMessage,
} from './types.js';

export type {
  TemplateAdapter,
  RenderedOutput,
  AnyTemplateAdapter,
} from './template.js';

export { formatAddress } from './lib/format-address.js';
export { normalizeAddress } from './lib/normalize-address.js';

export { EmailBuilder, createEmailBuilder } from './builder.js';
export type {
  AnyEmailBuilder,
  CompleteEmailBuilder,
  EmailDefinition,
  EmailDefinitionOf,
  IsComplete,
  SubjectResolver,
} from './builder.js';

export { createTransport, multiTransport, mockTransport } from './transports/index.js';
export type {
  Transport,
  TransportResult,
  TransportEntry,
  CreateTransportOptions,
  MultiTransportOptions,
  MultiTransportEntry,
  MultiTransportBackoff,
  MultiTransportStrategy,
  MockTransport,
} from './transports/index.js';

export { emailChannel } from './channel.js';
export type { EmailSendArgs } from './channel.js';
