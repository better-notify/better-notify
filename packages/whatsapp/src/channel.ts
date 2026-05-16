import { defineChannel, slot } from '@betternotify/core';
import type { ChannelBuilderCtx, ChannelDefinition, Channel } from '@betternotify/core';
import type { Transport } from '@betternotify/core';
import type {
  RenderedWhatsApp,
  RenderedWhatsAppText,
  RenderedWhatsAppImage,
  RenderedWhatsAppVideo,
  RenderedWhatsAppDocument,
  RenderedWhatsAppAudio,
  RenderedWhatsAppLocation,
  RenderedWhatsAppReaction,
  RenderedWhatsAppInteractive,
  RenderedWhatsAppContacts,
  RenderedWhatsAppTemplate,
  WhatsAppAction,
  WhatsAppMimeType,
  WhatsAppButton,
  WhatsAppSection,
  WhatsAppContact,
  WhatsAppTemplateComponent,
} from './types.js';
import {
  textArgsSchema,
  imageArgsSchema,
  videoArgsSchema,
  documentArgsSchema,
  audioArgsSchema,
  locationArgsSchema,
  reactionArgsSchema,
  interactiveArgsSchema,
  contactsArgsSchema,
  templateArgsSchema,
  permissiveArgsSchema,
} from './channel.schemas.js';

export type BodyResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);

export type UrlResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);

export type WhatsAppChannelOptions = {};

const createInternalChannels = (_options: WhatsAppChannelOptions) => {
  const text = defineChannel({
    name: 'whatsapp' as const,
    slots: {
      _action: slot.value<'text'>(),
      body: slot.resolver<string>(),
    },
    validateArgs: textArgsSchema,
    render: ({ runtime, args }): RenderedWhatsAppText => ({
      action: 'text',
      to: args.to,
      body: runtime.body,
    }),
  });

  const image = defineChannel({
    name: 'whatsapp' as const,
    slots: {
      _action: slot.value<'image'>(),
      url: slot.resolver<string>().optional(),
      data: slot.resolver<Buffer | Uint8Array>().optional(),
      mimeType: slot.resolver<WhatsAppMimeType>().optional(),
      caption: slot.resolver<string>().optional(),
    },
    validateArgs: imageArgsSchema,
    render: ({ runtime, args }): RenderedWhatsAppImage => {
      const result = {
        action: 'image' as const,
        to: args.to,
        ...(runtime.data !== undefined
          ? { data: runtime.data, mimeType: runtime.mimeType ?? 'image/jpeg' }
          : { url: runtime.url ?? '' }),
      };
      if (runtime.caption !== undefined) return { ...result, caption: runtime.caption };
      return result;
    },
  });

  const video = defineChannel({
    name: 'whatsapp' as const,
    slots: {
      _action: slot.value<'video'>(),
      url: slot.resolver<string>().optional(),
      data: slot.resolver<Buffer | Uint8Array>().optional(),
      mimeType: slot.resolver<WhatsAppMimeType>().optional(),
      caption: slot.resolver<string>().optional(),
    },
    validateArgs: videoArgsSchema,
    render: ({ runtime, args }): RenderedWhatsAppVideo => {
      const result = {
        action: 'video' as const,
        to: args.to,
        ...(runtime.data !== undefined
          ? { data: runtime.data, mimeType: runtime.mimeType ?? 'video/mp4' }
          : { url: runtime.url ?? '' }),
      };
      if (runtime.caption !== undefined) return { ...result, caption: runtime.caption };
      return result;
    },
  });

  const document = defineChannel({
    name: 'whatsapp' as const,
    slots: {
      _action: slot.value<'document'>(),
      url: slot.resolver<string>().optional(),
      data: slot.resolver<Buffer | Uint8Array>().optional(),
      mimeType: slot.resolver<WhatsAppMimeType>().optional(),
      caption: slot.resolver<string>().optional(),
      filename: slot.resolver<string>().optional(),
    },
    validateArgs: documentArgsSchema,
    render: ({ runtime, args }): RenderedWhatsAppDocument => {
      const result = {
        action: 'document' as const,
        to: args.to,
        ...(runtime.data !== undefined
          ? { data: runtime.data, mimeType: runtime.mimeType ?? 'application/octet-stream' }
          : { url: runtime.url ?? '' }),
      };
      const extras: Record<string, unknown> = {};
      if (runtime.caption !== undefined) extras.caption = runtime.caption;
      if (runtime.filename !== undefined) extras.filename = runtime.filename;
      return { ...result, ...extras } as RenderedWhatsAppDocument;
    },
  });

  const audio = defineChannel({
    name: 'whatsapp' as const,
    slots: {
      _action: slot.value<'audio'>(),
      url: slot.resolver<string>().optional(),
      data: slot.resolver<Buffer | Uint8Array>().optional(),
      mimeType: slot.resolver<WhatsAppMimeType>().optional(),
    },
    validateArgs: audioArgsSchema,
    render: ({ runtime, args }): RenderedWhatsAppAudio => ({
      action: 'audio',
      to: args.to,
      ...(runtime.data !== undefined
        ? { data: runtime.data, mimeType: runtime.mimeType ?? 'audio/mpeg' }
        : { url: runtime.url ?? '' }),
    }),
  });

  const location = defineChannel({
    name: 'whatsapp' as const,
    slots: {
      _action: slot.value<'location'>(),
      latitude: slot.resolver<number>(),
      longitude: slot.resolver<number>(),
      name: slot.resolver<string>().optional(),
      address: slot.resolver<string>().optional(),
    },
    validateArgs: locationArgsSchema,
    render: ({ runtime, args }): RenderedWhatsAppLocation => {
      const result: RenderedWhatsAppLocation = {
        action: 'location',
        to: args.to,
        latitude: runtime.latitude,
        longitude: runtime.longitude,
      };
      if (runtime.name !== undefined) result.name = runtime.name;
      if (runtime.address !== undefined) result.address = runtime.address;
      return result;
    },
  });

  const reaction = defineChannel({
    name: 'whatsapp' as const,
    slots: {
      _action: slot.value<'reaction'>(),
      emoji: slot.resolver<string>(),
    },
    validateArgs: reactionArgsSchema,
    render: ({ runtime, args }): RenderedWhatsAppReaction => ({
      action: 'reaction',
      to: args.to,
      emoji: runtime.emoji,
      messageId: args.messageId,
    }),
  });

  const interactive = defineChannel({
    name: 'whatsapp' as const,
    slots: {
      _action: slot.value<'interactive'>(),
      body: slot.resolver<string>(),
      header: slot.resolver<string>().optional(),
      footer: slot.resolver<string>().optional(),
      buttons: slot.resolver<Array<WhatsAppButton>>().optional(),
      sections: slot.resolver<Array<WhatsAppSection>>().optional(),
    },
    validateArgs: interactiveArgsSchema,
    render: ({ runtime, args }): RenderedWhatsAppInteractive => {
      const result: RenderedWhatsAppInteractive = {
        action: 'interactive',
        to: args.to,
        body: runtime.body,
      };
      if (runtime.header !== undefined) result.header = runtime.header;
      if (runtime.footer !== undefined) result.footer = runtime.footer;
      if (runtime.buttons !== undefined) result.buttons = runtime.buttons;
      if (runtime.sections !== undefined) result.sections = runtime.sections;
      return result;
    },
  });

  const contacts = defineChannel({
    name: 'whatsapp' as const,
    slots: {
      _action: slot.value<'contacts'>(),
      contacts: slot.resolver<Array<WhatsAppContact>>(),
    },
    validateArgs: contactsArgsSchema,
    render: ({ runtime, args }): RenderedWhatsAppContacts => ({
      action: 'contacts',
      to: args.to,
      contacts: runtime.contacts,
    }),
  });

  const template = defineChannel({
    name: 'whatsapp' as const,
    slots: {
      _action: slot.value<'template'>(),
      name: slot.resolver<string>(),
      language: slot.resolver<string>(),
      components: slot.resolver<Array<WhatsAppTemplateComponent>>().optional(),
    },
    validateArgs: templateArgsSchema,
    render: ({ runtime, args }): RenderedWhatsAppTemplate => {
      const result: RenderedWhatsAppTemplate = {
        action: 'template',
        to: args.to,
        templateName: runtime.name,
        language: runtime.language,
      };
      if (runtime.components !== undefined) result.components = runtime.components;
      return result;
    },
  });

  return {
    text,
    image,
    video,
    document,
    audio,
    location,
    reaction,
    interactive,
    contacts,
    template,
  };
};

type InternalChannels = ReturnType<typeof createInternalChannels>;
type TextBuilder = ReturnType<InternalChannels['text']['createBuilder']>;
type ImageBuilder = ReturnType<InternalChannels['image']['createBuilder']>;
type VideoBuilder = ReturnType<InternalChannels['video']['createBuilder']>;
type DocumentBuilder = ReturnType<InternalChannels['document']['createBuilder']>;
type AudioBuilder = ReturnType<InternalChannels['audio']['createBuilder']>;
type LocationBuilder = ReturnType<InternalChannels['location']['createBuilder']>;
type ReactionBuilder = ReturnType<InternalChannels['reaction']['createBuilder']>;
type InteractiveBuilder = ReturnType<InternalChannels['interactive']['createBuilder']>;
type ContactsBuilder = ReturnType<InternalChannels['contacts']['createBuilder']>;
type TemplateBuilder = ReturnType<InternalChannels['template']['createBuilder']>;

type PublicBuilder<B> = Omit<B, '_action' | '_args' | '_rendered' | '_state'>;

export type WhatsAppActionPicker = {
  text(): PublicBuilder<TextBuilder>;
  image(): PublicBuilder<ImageBuilder>;
  video(): PublicBuilder<VideoBuilder>;
  document(): PublicBuilder<DocumentBuilder>;
  audio(): PublicBuilder<AudioBuilder>;
  location(): PublicBuilder<LocationBuilder>;
  reaction(): PublicBuilder<ReactionBuilder>;
  interactive(): PublicBuilder<InteractiveBuilder>;
  contacts(): PublicBuilder<ContactsBuilder>;
  template(): PublicBuilder<TemplateBuilder>;
};

export type WhatsAppChannel = Channel<
  'whatsapp',
  WhatsAppActionPicker,
  unknown,
  RenderedWhatsApp,
  Transport<RenderedWhatsApp, unknown>
>;

export const whatsappChannel = (options: WhatsAppChannelOptions = {}): WhatsAppChannel => {
  const channels = createInternalChannels(options);

  return {
    name: 'whatsapp' as const,

    createBuilder: (ctx: ChannelBuilderCtx): WhatsAppActionPicker => ({
      text: () => {
        const builder = channels.text.createBuilder(ctx);
        return builder._action('text' as never) as PublicBuilder<TextBuilder>;
      },
      image: () => {
        const builder = channels.image.createBuilder(ctx);
        return builder._action('image' as never) as PublicBuilder<ImageBuilder>;
      },
      video: () => {
        const builder = channels.video.createBuilder(ctx);
        return builder._action('video' as never) as PublicBuilder<VideoBuilder>;
      },
      document: () => {
        const builder = channels.document.createBuilder(ctx);
        return builder._action('document' as never) as PublicBuilder<DocumentBuilder>;
      },
      audio: () => {
        const builder = channels.audio.createBuilder(ctx);
        return builder._action('audio' as never) as PublicBuilder<AudioBuilder>;
      },
      location: () => {
        const builder = channels.location.createBuilder(ctx);
        return builder._action('location' as never) as PublicBuilder<LocationBuilder>;
      },
      reaction: () => {
        const builder = channels.reaction.createBuilder(ctx);
        return builder._action('reaction' as never) as PublicBuilder<ReactionBuilder>;
      },
      interactive: () => {
        const builder = channels.interactive.createBuilder(ctx);
        return builder._action('interactive' as never) as PublicBuilder<InteractiveBuilder>;
      },
      contacts: () => {
        const builder = channels.contacts.createBuilder(ctx);
        return builder._action('contacts' as never) as PublicBuilder<ContactsBuilder>;
      },
      template: () => {
        const builder = channels.template.createBuilder(ctx);
        return builder._action('template' as never) as PublicBuilder<TemplateBuilder>;
      },
    }),

    validateArgs: (rawArgs: unknown) => permissiveArgsSchema.parse(rawArgs),

    render: async (
      def: ChannelDefinition<unknown, RenderedWhatsApp>,
      args: unknown,
      ctx: unknown,
    ): Promise<RenderedWhatsApp> => {
      const runtime = def.runtime as { _action: WhatsAppAction };
      const channel = channels[runtime._action];
      return channel.render(def as never, args as never, ctx);
    },

    finalize: (state: unknown, id: string) =>
      (
        state as { _finalize: (id: string) => ChannelDefinition<unknown, RenderedWhatsApp> }
      )._finalize(id),

    previewRender: undefined,
    _transport: undefined as never,
  };
};
