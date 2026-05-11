export { onesignalPushTransport } from './push.js';
export { onesignalEmailTransport } from './email.js';
export { onesignalSmsTransport } from './sms.js';
export { isOneSignalRetriable } from './is-retriable.js';
export type {
  OneSignalTransportOptions,
  OneSignalPushTransportOptions,
  OneSignalEmailTransportOptions,
  OneSignalSmsTransportOptions,
  OneSignalBaseBody,
  OneSignalPushBody,
  OneSignalEmailBody,
  OneSignalSmsBody,
  OneSignalBody,
  OneSignalFilter,
  OneSignalSuccessResponse,
  OneSignalErrorResponse,
} from './types.js';

declare module '@betternotify/core' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires interface
  interface TransportDataMap {
    onesignal: import('@betternotify/core').PerChannel<{
      push: import('@betternotify/onesignal').OneSignalPushBody;
      email: import('@betternotify/onesignal').OneSignalEmailBody;
      sms: import('@betternotify/onesignal').OneSignalSmsBody;
    }>;
  }
}
