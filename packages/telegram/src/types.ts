export type TelegramChatId = string | number;

export type TelegramParseMode = 'HTML' | 'Markdown' | 'MarkdownV2';

export type TelegramAttachment = {
  type: 'photo' | 'document' | 'video' | 'audio';
  url: string;
  caption?: string;
};

export type TelegramSendArgs<TInput = unknown> = {
  to: TelegramChatId;
  input: TInput;
};

export type RenderedTelegram = {
  body: string;
  to?: TelegramChatId;
  parseMode?: TelegramParseMode;
  attachment?: TelegramAttachment;
};
