import { createTransport as createCoreTransport } from '@betternotify/core';
import type { CreateTransportOptions as CoreCreateTransportOptions } from '@betternotify/core';
import type { RenderedMessage } from '../types.js';
import type { EmailTransportData, Transport } from './types.js';

export type CreateTransportOptions = CoreCreateTransportOptions<
  RenderedMessage,
  EmailTransportData
>;

export const createTransport = (opts: CreateTransportOptions): Transport =>
  createCoreTransport<RenderedMessage, EmailTransportData>(opts);
