import { createEnv } from '@t3-oss/env-core';
import z from 'zod';

export const env = createEnv({
  server: {
    TELEGRAM_CHAT_ID: z.coerce.number().optional().default(123456).describe('Telegram chat ID'),
    TELEGRAM_BOT_TOKEN: z.string().optional().default('token').describe('Telegram bot token'),

    SMTP_HOST: z.string().optional().default('localhost').describe('SMTP host'),
    SMTP_PORT: z.coerce.number().optional().default(587).describe('SMTP port'),
    SMTP_USER: z.string().optional().default('user@example.com').describe('SMTP user'),
    SMTP_PASSWORD: z.string().optional().default('password').describe('SMTP password'),

    SMTP_FROM_NAME: z.string().optional().default('Welcome Bot').describe('SMTP from name'),
    SMTP_DESTINATION_EMAIL: z
      .string()
      .optional()
      .default('example@email.com')
      .describe('SMTP destination email'),
  },
  runtimeEnv: process.env,
});
