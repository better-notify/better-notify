export type {
  WhatsAppAction,
  WhatsAppMimeType,
  WhatsAppMediaSource,
  WhatsAppButton,
  WhatsAppSectionRow,
  WhatsAppSection,
  WhatsAppContact,
  RenderedWhatsAppText,
  RenderedWhatsAppImage,
  RenderedWhatsAppVideo,
  RenderedWhatsAppDocument,
  RenderedWhatsAppAudio,
  RenderedWhatsAppLocation,
  RenderedWhatsAppReaction,
  RenderedWhatsAppInteractive,
  RenderedWhatsAppContacts,
  RenderedWhatsApp,
  WhatsAppTextSendArgs,
  WhatsAppImageSendArgs,
  WhatsAppVideoSendArgs,
  WhatsAppDocumentSendArgs,
  WhatsAppAudioSendArgs,
  WhatsAppLocationSendArgs,
  WhatsAppReactionSendArgs,
  WhatsAppInteractiveSendArgs,
  WhatsAppContactsSendArgs,
} from './types.js';
export { whatsappChannel } from './channel.js';
export type {
  BodyResolver,
  UrlResolver,
  WhatsAppActionPicker,
  WhatsAppChannel,
  WhatsAppChannelOptions,
} from './channel.js';
export { isWhatsappRetriable } from './is-retriable.js';

declare module '@betternotify/core' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires interface
  interface TransportDataMap {
    whatsapp: import('./transports/types.js').WhatsappTransportData;
  }
}
