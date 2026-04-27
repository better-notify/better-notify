import type { AnyTransport } from '../transport.js';

export type { Transport, TransportResult, AnyTransport, SendContext } from '../transport.js';

export type TransportEntry = {
  name: string;
  transport: AnyTransport;
  priority: number;
};
