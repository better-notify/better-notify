import { createEnv } from '@t3-oss/env-core';
import z from 'zod';

export const env = createEnv({
  server: {
    /**
     * Telegram cluster
     */
    TELEGRAM_CHAT_ID: z.coerce.number().optional().default(123456).describe('Telegram chat ID'),
    TELEGRAM_BOT_TOKEN: z.string().optional().default('token').describe('Telegram bot token'),

    DISCORD_WEBHOOK_URL: z
      .string()
      .optional()
      .default('https://discord.com/api/webhooks/0/token')
      .describe('Discord webhook URL'),

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

    /**
     * Cloudflare cluster
     */
    CF_ACCOUNT_ID: z.string().optional().default('account-id').describe('Cloudflare account ID'),
    CF_API_TOKEN: z.string().optional().default('api-token').describe('Cloudflare API token'),
    CF_FROM_EMAIL: z
      .string()
      .optional()
      .default('noreply@example.com')
      .describe('Cloudflare from email'),
    CF_DESTINATION_EMAIL: z
      .string()
      .optional()
      .default('example@email.com')
      .describe('Cloudflare destination email'),

    /**
     * Resend cluster
     */
    RESEND_API_KEY: z.string().optional().default('re_test_123').describe('Resend API key'),
    RESEND_FROM_EMAIL: z
      .string()
      .optional()
      .default('noreply@example.com')
      .describe('Resend from email'),
    RESEND_DESTINATION_EMAIL: z
      .string()
      .optional()
      .default('example@email.com')
      .describe('Resend destination email'),

    /**
     * Slack cluster
     */
    SLACK_BOT_TOKEN: z.string().optional().default('xoxb-test').describe('Slack bot token'),
    SLACK_CHANNEL: z.string().optional().default('#general').describe('Slack channel'),
  },
  runtimeEnv: process.env,
});
