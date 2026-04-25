/**
 * §4.2 spec example, used as a compile-time smoke test that the public
 * @emailrpc/core surface lets a downstream consumer write the canonical
 * "welcome" definition with full inference. Not published, not bundled —
 * tsc reads it via the workspace include below.
 */

import { z } from 'zod'
import { emailRpc, type TemplateAdapter } from '@emailrpc/core'

interface AppContext {
  requestId: string
  locale: 'en' | 'pt-BR' | 'nl'
}

const t = emailRpc.init<AppContext>()

interface WelcomeProps {
  name: string
  verifyUrl: string
  locale: 'en' | 'pt-BR' | 'nl'
}

const welcomeAdapter: TemplateAdapter<WelcomeProps> = {
  render: async ({ name, verifyUrl }) => ({
    html: `<a href="${verifyUrl}">Hi ${name}</a>`,
  }),
}

export const welcome = t
  .email('welcome')
  .input(
    z.object({
      to: z.string().email(),
      name: z.string().min(1),
      verifyUrl: z.string().url(),
      locale: z.enum(['en', 'pt-BR', 'nl']).default('en'),
    }),
  )
  .from('hello@example.com')
  .replyTo('support@example.com')
  .subject(({ input }) =>
    ({ en: `Welcome, ${input.name}!`, 'pt-BR': `Bem-vindo, ${input.name}!`, nl: `Welkom, ${input.name}!` })[
      input.locale
    ],
  )
  .template(welcomeAdapter)
  .tags({ category: 'transactional', flow: 'onboarding' })
  .priority('normal')

export const emails = t.router({ welcome })
export type EmailRouter = typeof emails
