/** @see https://core.telegram.org/bots/api#markdownv2-style */
const MARKDOWNV2_SPECIAL = /([_*[\]()~`>#+\-=|{}.!\\])/g;

/** Escapes all MarkdownV2 reserved characters in a string. @see https://core.telegram.org/bots/api#markdownv2-style */
export const escapeMarkdownV2 = (text: string): string => text.replace(MARKDOWNV2_SPECIAL, '\\$1');

const NON_FORMATTING_RESERVED = /([#+={}.,!\\-])/g;

/** Tagged template that escapes interpolated values for MarkdownV2 while preserving formatting syntax. @see https://core.telegram.org/bots/api#markdownv2-style */
export const md = (strings: TemplateStringsArray, ...values: unknown[]): string => {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    const raw = strings[i] ?? '';
    result += raw.replace(NON_FORMATTING_RESERVED, '\\$1');
    if (i < values.length) {
      result += escapeMarkdownV2(String(values[i]));
    }
  }
  return result;
};
