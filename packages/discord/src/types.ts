export type DiscordEmbedFooter = {
  text: string;
  icon_url?: string;
};

export type DiscordEmbedImage = {
  url: string;
};

export type DiscordEmbedAuthor = {
  name: string;
  url?: string;
  icon_url?: string;
};

export type DiscordEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

export type DiscordEmbed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  footer?: DiscordEmbedFooter;
  image?: DiscordEmbedImage;
  thumbnail?: DiscordEmbedImage;
  author?: DiscordEmbedAuthor;
  fields?: DiscordEmbedField[];
};

export type DiscordSendArgs<TInput = unknown> = {
  input: TInput;
};

export type DiscordAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  description?: string;
};

export type RenderedDiscord = {
  body: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatarUrl?: string;
  attachments?: DiscordAttachment[];
};
