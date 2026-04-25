import { describe, expect, it, expectTypeOf } from 'vitest'
import { z } from 'zod'
import { emailRpc } from '../src/index.js'
import type { InputOf, OutputOf } from '../src/router.js'
import type { TemplateAdapter } from '../src/template.js'

const adapter = <T>(): TemplateAdapter<T> => ({ render: async () => ({ html: '' }) })

describe('createRouter runtime', () => {
  const t = emailRpc.init()
  const welcome = t
    .email('welcome')
    .input(z.object({ name: z.string(), to: z.string().email() }))
    .subject(({ input }) => `Hi ${input.name}`)
    .template(adapter<{ name: string; to: string }>())

  const passwordReset = t
    .email('passwordReset')
    .input(z.object({ resetUrl: z.string().url(), to: z.string().email() }))
    .subject('Reset')
    .template(adapter<{ resetUrl: string; to: string }>())

  const router = t.router({ welcome, passwordReset })

  it('exposes the route ids', () => {
    expect(router.routes).toEqual(['welcome', 'passwordReset'])
  })

  it('preserves email definitions keyed by route id', () => {
    expect(router.emails.welcome.id).toBe('welcome')
    expect(router.emails.passwordReset.id).toBe('passwordReset')
  })

  it('throws at runtime when given an incomplete builder (defensive guard)', () => {
    const incomplete = t.email('broken')
    // bypass type system to verify runtime guard
    expect(() => t.router({ incomplete } as never)).toThrow(/incomplete/)
  })
})

describe('createRouter type-level guarantees', () => {
  const t = emailRpc.init()

  it('rejects routers that include an incomplete builder', () => {
    const complete = t
      .email('a')
      .input(z.object({ x: z.string() }))
      .subject('s')
      .template(adapter<{ x: string }>())
    const missingTemplate = t.email('b').input(z.object({ y: z.string() })).subject('s')

    expect(() => {
      // @ts-expect-error — missingTemplate has no template, should fail
      t.router({ complete, missingTemplate })
    }).toThrow(/incomplete/)
  })

  it('rejects routers that include a builder with no input', () => {
    const noInput = t.email('a')
    expect(() => {
      // @ts-expect-error — noInput is missing input, subject, template
      t.router({ noInput })
    }).toThrow(/incomplete/)
  })

  it('exposes input/output type helpers on the router', () => {
    const a = t
      .email('a')
      .input(z.object({ name: z.string(), age: z.number().default(0) }))
      .subject('s')
      .template(adapter<{ name: string; age: number }>())
    const r = t.router({ a })

    expectTypeOf<InputOf<typeof r, 'a'>>().toEqualTypeOf<{ name: string; age?: number }>()
    expectTypeOf<OutputOf<typeof r, 'a'>>().toEqualTypeOf<{ name: string; age: number }>()
  })
})
