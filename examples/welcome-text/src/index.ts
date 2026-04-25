import { validate, EmailRpcValidationError } from '@emailrpc/core'
import { emails } from './emails.ts'

/**
 * Layer 2 (the typed sender) lands in v0.2. Until then, this helper performs
 * the same steps the sender will run: validate input → resolve subject →
 * render template → assemble the outgoing message. Replace this with
 * `mail.welcome(input)` when `createSender` ships.
 */
async function send<K extends keyof typeof emails.emails>(
  route: K,
  rawInput: unknown,
) {
  const def = emails.emails[route]
  const input = await validate(def.schema, rawInput, { route })

  const subject =
    typeof def.subject === 'function' ? def.subject({ input }) : def.subject
  const rendered = await def.template.render(input)

  return {
    from: def.from,
    to: (input as { to: string }).to,
    subject,
    text: rendered.text ?? '',
    html: rendered.html,
  }
}

async function main() {
  try {
    const message = await send('welcome', {
      to: 'lucas@example.com',
      name: 'Lucas',
      verifyUrl: 'https://example.com/verify?token=abc123',
    })

    console.log('From:    ', message.from)
    console.log('To:      ', message.to)
    console.log('Subject: ', message.subject)
    console.log('---')
    console.log(message.text)
  } catch (err) {
    if (err instanceof EmailRpcValidationError) {
      console.error('Validation failed:', err.message)
      for (const issue of err.issues) {
        console.error(' -', issue.message, 'at', issue.path?.join('.') ?? '<root>')
      }
      process.exitCode = 1
      return
    }
    throw err
  }
}

await main()
