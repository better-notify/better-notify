export type { SmsAddress, SmsSendArgs, RenderedSms } from './types.js';
export { smsChannel } from './channel.js';
export type { BodyResolver } from './channel.js';
export {
  mockSmsTransport,
  multiTransport,
  createTransport,
} from './transports/index.js';
export type {
  Transport,
  SmsTransportData,
  SmsTransportResult,
  MockSmsTransport,
  MultiTransportOptions,
  CreateTransportOptions,
} from './transports/index.js';
