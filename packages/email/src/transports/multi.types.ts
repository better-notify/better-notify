import type {
  MultiTransportOptions as CoreMultiTransportOptions,
  MultiTransportEntry as CoreMultiTransportEntry,
  MultiTransportBackoff as CoreMultiTransportBackoff,
  MultiTransportStrategy as CoreMultiTransportStrategy,
} from '@emailrpc/core';
import type { RenderedMessage } from '../types.js';
import type { EmailTransportData } from './types.js';

export type MultiTransportStrategy = CoreMultiTransportStrategy;
export type MultiTransportBackoff = CoreMultiTransportBackoff;
export type MultiTransportEntry = CoreMultiTransportEntry<RenderedMessage, EmailTransportData>;
export type MultiTransportOptions = CoreMultiTransportOptions<RenderedMessage, EmailTransportData>;
