import { os } from '@orpc/server';
import { z } from 'zod';
import { notificationService } from './notify';

const injectNotify = os.middleware(async ({ next }) => {
  return next({ context: { notificationService } });
});

const base = os.use(injectNotify);

export const sendWelcome = base
  .input(
    z.object({
      to: z.email(),
      name: z.string(),
      verifyUrl: z.url(),
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
