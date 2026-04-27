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

export { withSuppressionList } from './middlewares/with-suppression-list.js';
export type {
  WithSuppressionListOptions,
  SuppressionField,
} from './middlewares/with-suppression-list.types.js';

export { emailChannel } from './channel.js';
export type {
  EmailSendArgs,
  SubjectResolver,
  TemplateInput,
  EmailChannelOptions,
} from './channel.js';
