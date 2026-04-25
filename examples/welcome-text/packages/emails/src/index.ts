import { z } from 'zod';
import { emailRpc, type TemplateAdapter } from '@emailrpc/core';

const textTemplate = <TInput>(body: (input: TInput) => string): TemplateAdapter<TInput> => {
  return {
    render: async (input) => {
      const text = body(input);
      return {
        text,
        html: `<pre style="font-family:sans-serif;white-space:pre-wrap;">${escapeHtml(text)}</pre>`,
      };
    },
  };
};

const escapeHtml = (s: string): string => {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
};

const welcomeInputSchema = z.object({
  name: z.string().min(1),
  verifyUrl: z.string().url(),
});

const reminderInputSchema = z.object({
  message: z.string().min(1),
});

const t = emailRpc.init();

export const emails = t.router({
  welcome: t
    .email()
    .input(welcomeInputSchema)
    .from('hello@example.com')
    .subject(({ input }) => `Welcome, ${input.name}!`)
    .template(
      textTemplate<z.infer<typeof welcomeInputSchema>>(({ name, verifyUrl }) =>
        [
          `Hi ${name},`,
          ``,
          `Thanks for signing up. Confirm your email address by visiting:`,
          verifyUrl,
          ``,
          `If you didn't create this account, you can ignore this message.`,
          ``,
          `— The Example Team`,
        ].join('\n'),
      ),
    ),
  reminder: t
    .email()
    .input(reminderInputSchema)
    .subject(({ input }) => `Reminder: ${input.message}`)
    .template(
      textTemplate<z.infer<typeof reminderInputSchema>>(({ message }) =>
        [`Reminder: ${message}`].join('\n'),
      ),
    ),
});

export type EmailRouter = typeof emails;
