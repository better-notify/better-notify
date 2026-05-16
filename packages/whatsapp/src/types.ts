export type WhatsAppAction =
  | 'text'
  | 'image'
  | 'video'
  | 'document'
  | 'audio'
  | 'location'
  | 'reaction'
  | 'interactive'
  | 'contacts'
  | 'template';

export type WhatsAppMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'video/mp4'
  | 'video/3gpp'
  | 'audio/aac'
  | 'audio/mp4'
  | 'audio/mpeg'
  | 'audio/amr'
  | 'audio/ogg'
  | 'audio/ogg; codecs=opus'
  | 'application/pdf'
  | 'application/msword'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.ms-excel'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.ms-powerpoint'
  | 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  | 'text/plain'
  | 'application/octet-stream'
  | (string & {});

export type WhatsAppMediaSource =
  | { url: string; data?: undefined; mimeType?: WhatsAppMimeType }
  | { url?: undefined; data: Buffer | Uint8Array; mimeType: WhatsAppMimeType };

export type WhatsAppButton = {
  id: string;
  title: string;
};

export type WhatsAppSectionRow = {
  id: string;
  title: string;
  description?: string;
};

export type WhatsAppSection = {
  title: string;
  rows: Array<WhatsAppSectionRow>;
};

export type WhatsAppContact = {
  name: { formatted: string; first?: string; last?: string };
  phones?: Array<{ phone: string; type?: string }>;
  emails?: Array<{ email: string; type?: string }>;
};

export type RenderedWhatsAppText = {
  action: 'text';
  to: string;
  body: string;
};

export type RenderedWhatsAppImage = {
  action: 'image';
  to: string;
  caption?: string;
} & WhatsAppMediaSource;

export type RenderedWhatsAppVideo = {
  action: 'video';
  to: string;
  caption?: string;
} & WhatsAppMediaSource;

export type RenderedWhatsAppDocument = {
  action: 'document';
  to: string;
  caption?: string;
  filename?: string;
} & WhatsAppMediaSource;

export type RenderedWhatsAppAudio = {
  action: 'audio';
  to: string;
} & WhatsAppMediaSource;

export type RenderedWhatsAppLocation = {
  action: 'location';
  to: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
};

export type RenderedWhatsAppReaction = {
  action: 'reaction';
  to: string;
  emoji: string;
  messageId: string;
};

export type RenderedWhatsAppInteractive = {
  action: 'interactive';
  to: string;
  body: string;
  header?: string;
  footer?: string;
  buttons?: Array<WhatsAppButton>;
  sections?: Array<WhatsAppSection>;
};

export type RenderedWhatsAppContacts = {
  action: 'contacts';
  to: string;
  contacts: Array<WhatsAppContact>;
};

export type WhatsAppTemplateTextParam = { type: 'text'; text: string };

export type WhatsAppTemplateMediaParam =
  | { type: 'image'; image: { link: string } | { id: string } }
  | { type: 'video'; video: { link: string } | { id: string } }
  | {
      type: 'document';
      document: { link: string } | { id: string };
      filename?: string;
    };

export type WhatsAppTemplateCurrencyParam = {
  type: 'currency';
  currency: { fallback_value: string; code: string; amount_1000: number };
};

export type WhatsAppTemplateDateTimeParam = {
  type: 'date_time';
  date_time: { fallback_value: string };
};

export type WhatsAppTemplateLocationParam = {
  type: 'location';
  location: { latitude: number; longitude: number; name?: string; address?: string };
};

export type WhatsAppTemplateHeaderParam =
  | WhatsAppTemplateTextParam
  | WhatsAppTemplateMediaParam
  | WhatsAppTemplateLocationParam;

export type WhatsAppTemplateBodyParam =
  | WhatsAppTemplateTextParam
  | WhatsAppTemplateCurrencyParam
  | WhatsAppTemplateDateTimeParam;

export type WhatsAppTemplateButtonSubType =
  | 'quick_reply'
  | 'url'
  | 'copy_code'
  | 'catalog'
  | 'mpm'
  | 'flow';

export type WhatsAppTemplateButtonParam =
  | WhatsAppTemplateTextParam
  | { type: 'payload'; payload: string };

/**
 * A single component on a Meta-approved business template. Matches Meta's
 * `template.components[]` wire shape verbatim: header / body / button entries
 * each carrying their own typed `parameters` array.
 *
 * @see https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
 */
export type WhatsAppTemplateComponent =
  | { type: 'header'; parameters: Array<WhatsAppTemplateHeaderParam> }
  | { type: 'body'; parameters: Array<WhatsAppTemplateBodyParam> }
  | {
      type: 'button';
      sub_type: WhatsAppTemplateButtonSubType;
      index: string;
      parameters: Array<WhatsAppTemplateButtonParam>;
    };

/**
 * Rendered shape for a Meta-approved business template send. Templates must
 * be registered and approved in the Meta Business Manager before use.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
 * @see https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 */
export type RenderedWhatsAppTemplate = {
  action: 'template';
  to: string;
  templateName: string;
  language: string;
  components?: Array<WhatsAppTemplateComponent>;
};

export type RenderedWhatsApp =
  | RenderedWhatsAppText
  | RenderedWhatsAppImage
  | RenderedWhatsAppVideo
  | RenderedWhatsAppDocument
  | RenderedWhatsAppAudio
  | RenderedWhatsAppLocation
  | RenderedWhatsAppReaction
  | RenderedWhatsAppInteractive
  | RenderedWhatsAppContacts
  | RenderedWhatsAppTemplate;

export type WhatsAppTextSendArgs<TInput = unknown> = {
  to: string;
  input: TInput;
};

export type WhatsAppImageSendArgs<TInput = unknown> = {
  to: string;
  input: TInput;
};

export type WhatsAppVideoSendArgs<TInput = unknown> = {
  to: string;
  input: TInput;
};

export type WhatsAppDocumentSendArgs<TInput = unknown> = {
  to: string;
  input: TInput;
};

export type WhatsAppAudioSendArgs<TInput = unknown> = {
  to: string;
  input: TInput;
};

export type WhatsAppLocationSendArgs<TInput = unknown> = {
  to: string;
  input: TInput;
};

export type WhatsAppReactionSendArgs<TInput = unknown> = {
  to: string;
  messageId: string;
  input: TInput;
};

export type WhatsAppInteractiveSendArgs<TInput = unknown> = {
  to: string;
  input: TInput;
};

export type WhatsAppContactsSendArgs<TInput = unknown> = {
  to: string;
  input: TInput;
};

export type WhatsAppTemplateSendArgs<TInput = unknown> = {
  to: string;
  input: TInput;
};
