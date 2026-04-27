import type { Transport as CoreTransport } from '@emailrpc/core';
import type { RenderedSms } from '../types.js';

export type SmsTransportData = {
  messageId: string;
  provider?: string;
};

export type SmsTransportResult = SmsTransportData;

export type Transport = CoreTransport<RenderedSms, SmsTransportData>;
