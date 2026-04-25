import { z } from 'zod'
import { emailRpc, type TemplateAdapter } from '@emailrpc/core'

/**
 * A minimal text-only template adapter. The body is computed from a function
 * over the validated input. We populate `text` and use the same string for
 * `html` (wrapped in a <pre> tag) so a future SMTP send still produces a
 * valid multipart/alternative message.
 */
function textTemplate<TInput>(
  body: (input: TInput) => string,
): TemplateAdapter<TInput> {
  return {
    render: async (input) => {
      const text = body(input)
      return {
        text,
        html: `<pre style="font-family:sans-serif;white-space:pre-wrap;">${escapeHtml(text)}</pre>`,
      }
    },
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

const welcomeInput = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  verifyUrl: z.string().url(),
})

const t = emailRpc.init()

export const welcome = t
  .email('welcome')
  .input(welcomeInput)
  .from('hello@example.com')
  .subject(({ input }) => `Welcome, ${input.name}!`)
  .template(
    textTemplate<z.infer<typeof welcomeInput>>(({ name, verifyUrl }) =>
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
  )

export const emails = t.router({ welcome })
export type EmailRouter = typeof emails
