import { createEnv } from '@t3-oss/env-core';
import z from 'zod';

export const env = createEnv({
  server: {
    /**
     * Autosend cluster
     */
    AUTOSEND_API_KEY: z.string().optional().default('as_test_123').describe('Autosend API key'),
    AUTOSEND_FROM_EMAIL: z
      .string()
      .optional()
      .default('noreply@example.com')
      .describe('Autosend from email'),
    AUTOSEND_DESTINATION_EMAIL: z
      .string()
      .optional()
      .default('example@email.com')
      .describe('Autosend destination email'),

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
     * Discord cluster
     */
    DISCORD_WEBHOOK_URL: z
      .string()
      .optional()
      .default('https://discord.com/api/webhooks/0/token')
      .describe('Discord webhook URL'),

    /**
     * GitHub cluster
     */
    GITHUB_TOKEN: z
      .string()
      .optional()
      .default('ghp_test')
      .describe('GitHub personal access token'),
    GITHUB_REPO: z.string().optional().default('owner/repo').describe('GitHub repo (owner/repo)'),
    GITHUB_PR_NUMBER: z.coerce.number().optional().default(1).describe('GitHub PR number'),

    /**
     * Mandrill cluster
     */
    MANDRILL_API_KEY: z.string().optional().default('md-test-123').describe('Mandrill API key'),
    MANDRILL_FROM_EMAIL: z
      .string()
      .optional()
      .default('noreply@example.com')
      .describe('Mandrill from email'),
    MANDRILL_DESTINATION_EMAIL: z
      .string()
      .optional()
      .default('example@email.com')
      .describe('Mandrill destination email'),

    /**
     * OneSignal cluster
     */
    ONESIGNAL_APP_ID: z.string().optional().default('app-id').describe('OneSignal app ID'),
    ONESIGNAL_API_KEY: z.string().optional().default('api-key').describe('OneSignal API key'),
    ONESIGNAL_FROM_EMAIL: z
      .string()
      .optional()
      .default('noreply@example.com')
      .describe('OneSignal from email'),
    ONESIGNAL_DESTINATION_EMAIL: z
      .string()
      .optional()
      .default('example@email.com')
      .describe('OneSignal destination email'),
    ONESIGNAL_SMS_FROM: z
      .string()
      .optional()
      .default('+15551234567')
      .describe('OneSignal SMS sender ID'),

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
     * Selligent cluster
     */
    SELLIGENT_CLIENT_ID: z
      .string()
      .optional()
      .default('12345')
      .describe('Selligent OAuth client ID'),
    SELLIGENT_CLIENT_SECRET: z
      .string()
      .optional()
      .default('secret123')
      .describe('Selligent OAuth client secret'),
    SELLIGENT_ACCOUNT_ID: z
      .string()
      .optional()
      .default('ACCT_ABC')
      .describe('Selligent account ID'),
    SELLIGENT_FROM_EMAIL: z
      .string()
      .optional()
      .default('noreply@example.com')
      .describe('Selligent from email'),
    SELLIGENT_DESTINATION_EMAIL: z
      .string()
      .optional()
      .default('example@email.com')
      .describe('Selligent destination email'),

    /**
     * Slack cluster
     */
    SLACK_BOT_TOKEN: z.string().optional().default('xoxb-test').describe('Slack bot token'),
    SLACK_CHANNEL: z.string().optional().default('#general').describe('Slack channel'),

    /**
     * SMTP cluster
     */
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
     * Telegram cluster
     */
    TELEGRAM_CHAT_ID: z.coerce.number().optional().default(123456).describe('Telegram chat ID'),
    TELEGRAM_BOT_TOKEN: z.string().optional().default('token').describe('Telegram bot token'),

    /**
     * Twilio cluster
     */
    TWILIO_ACCOUNT_SID: z.string().optional().default('AC_test').describe('Twilio Account SID'),
    TWILIO_AUTH_TOKEN: z.string().optional().default('token').describe('Twilio Auth Token'),
    TWILIO_FROM_NUMBER: z
      .string()
      .optional()
      .default('+15551234567')
      .describe('Twilio sender phone number'),
    TWILIO_DESTINATION_NUMBER: z
      .string()
      .optional()
      .default('+15559876543')
      .describe('Twilio destination phone number'),

    /**
     * Zapier cluster
     */
    ZAPIER_WEBHOOK_URL: z
      .string()
      .optional()
      .default('https://hooks.zapier.com/hooks/catch/123/abc')
      .describe('Zapier webhook URL'),
  },
  runtimeEnv: process.env,
});
