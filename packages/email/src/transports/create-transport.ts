import { createTransport as createCoreTransport } from '@betternotify/core/transports';
import type { CreateTransportOptions as CoreCreateTransportOptions } from '@betternotify/core/transports';
import type { RenderedMessage } from '../types.js';
import type { EmailTransportData, Transport } from './types.js';

export type CreateTransportOptions = CoreCreateTransportOptions<
  RenderedMessage,
  EmailTransportData
>;

export const createTransport = (opts: CreateTransportOptions): Transport =>
  createCoreTransport<RenderedMessage, EmailTransportData>(opts);
