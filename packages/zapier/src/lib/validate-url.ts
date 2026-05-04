import { NotifyRpcError } from '@betternotify/core';

const redactUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/***`;
  } catch {
    return '(malformed)';
  }
};

export const validateWebhookUrl = (url: string): void => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new NotifyRpcError({
      message: 'Zapier: invalid webhook URL',
      code: 'CONFIG',
    });
  }

  if (parsed.protocol !== 'https:') {
    throw new NotifyRpcError({
      message: `Zapier: webhook URL must use HTTPS (got ${parsed.protocol} for ${redactUrl(url)})`,
      code: 'CONFIG',
    });
  }
};
