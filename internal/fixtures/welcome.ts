import { z } from 'zod';
import { createEmailRpc, type TemplateAdapter } from '@emailrpc/core';

type AppContext = {
  requestId: string;
  locale: 'en' | 'pt-BR' | 'nl';
};

const rpc = createEmailRpc<AppContext>();

type WelcomeProps = {
  name: string;
  verifyUrl: string;
  locale: 'en' | 'pt-BR' | 'nl';
};

const welcomeAdapter: TemplateAdapter<WelcomeProps> = {
  render: async ({ input: { name, verifyUrl } }) => ({
    html: `<a href="${verifyUrl}">Hi ${name}</a>`,
  }),
};

export const welcome = rpc
  .email()
  .input(
    z.object({
      name: z.string().min(1),
      verifyUrl: z.string().url(),
      locale: z.enum(['en', 'pt-BR', 'nl']).default('en'),
    }),
  )
  .from('hello@example.com')
  .replyTo('support@example.com')
  .subject(
    ({ input }) =>
      ({
        en: `Welcome, ${input.name}!`,
        'pt-BR': `Bem-vindo, ${input.name}!`,
        nl: `Welkom, ${input.name}!`,
      })[input.locale],
  )
  .template(welcomeAdapter)
  .tags({ category: 'transactional', flow: 'onboarding' })
  .priority('normal');

export const emails = rpc.catalog({ welcome });
export type EmailCatalog = typeof emails;
