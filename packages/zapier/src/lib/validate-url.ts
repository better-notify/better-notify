import { NotifyRpcError } from '@betternotify/core';

export const validateWebhookUrl = (url: string): void => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new NotifyRpcError({
      message: `Zapier: invalid webhook URL: "${url}"`,
      code: 'CONFIG',
    });
  }

  if (parsed.protocol !== 'https:') {
    throw new NotifyRpcError({
      message: `Zapier: webhook URL must use HTTPS, got "${parsed.protocol}"`,
      code: 'CONFIG',
    });
  }
};
