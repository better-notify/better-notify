import type {
  Transport as CoreTransport,
  TransportResult as CoreTransportResult,
  SendContext,
} from '@emailrpc/core';
import type { RenderedMessage } from '../types.js';

export type EmailTransportData = {
  transportMessageId?: string;
  accepted: string[];
  rejected: string[];
  raw?: unknown;
};

export type TransportResult = CoreTransportResult<EmailTransportData>;

export type Transport = CoreTransport<RenderedMessage, EmailTransportData>;

export type { SendContext };

export type TransportEntry = {
  name: string;
  transport: Transport;
  priority: number;
};
