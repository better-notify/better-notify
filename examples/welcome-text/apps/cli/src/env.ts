import { createEnv } from '@t3-oss/env-core';
import z from 'zod';

export const env = createEnv({
  server: {
    SMTP_HOST: z.string().describe('SMTP host'),
    SMTP_PORT: z.coerce.number().describe('SMTP port'),
    SMTP_USER: z.string().describe('SMTP user'),
    SMTP_PASSWORD: z.string().describe('SMTP password'),

    SMTP_FROM_NAME: z.string().optional().default('Welcome Bot').describe('SMTP from name'),
    SMTP_DESTINATION_EMAIL: z
      .string()
      .optional()
      .default('example@email.com')
      .describe('SMTP destination email'),
  },
  runtimeEnv: process.env,
});
