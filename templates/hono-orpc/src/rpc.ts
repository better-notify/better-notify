import { os } from '@orpc/server';
import { z } from 'zod';
import type { notificationService } from './notify';

type AppContext = {
  notificationService: typeof notificationService;
};

const base = os.$context<AppContext>();

export const sendWelcome = base
  .input(
    z.object({
      to: z.string().email(),
      name: z.string(),
      verifyUrl: z.string().url(),
    }),
  )
  .handler(async ({ input, context }) => {
    const result = await context.notificationService.welcome.send({
      to: input.to,
      input: { name: input.name, verifyUrl: input.verifyUrl },
    });
    return { messageId: result.messageId };
  });

export const router = {
  notification: {
    sendWelcome,
  },
};
