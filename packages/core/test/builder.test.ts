import { describe, expect, it, expectTypeOf } from 'vitest'
import { z } from 'zod'
import { emailRpc } from '../src/index.js'
import type { TemplateAdapter } from '../src/template.js'

const stubAdapter: TemplateAdapter<{ name: string; verifyUrl: string; locale: 'en' | 'pt-BR' }> = {
  render: async () => ({ html: '<p>hi</p>' }),
}

describe('EmailBuilder runtime', () => {
  it('preserves the route id', () => {
    const t = emailRpc.init()
    const def = t.email('welcome')
    expect(def._state.id).toBe('welcome')
  })

  it('stores schema, subject, template, and metadata', () => {
    const t = emailRpc.init()
    const schema = z.object({
      name: z.string(),
      verifyUrl: z.string().url(),
      locale: z.enum(['en', 'pt-BR']).default('en'),
    })
    const def = t
      .email('welcome')
      .input(schema)
      .from('hello@example.com')
      .replyTo('support@example.com')
      .subject(({ input }) => `Welcome, ${input.name}!`)
      .template(stubAdapter)
      .tags({ category: 'transactional' })
      .priority('high')

    expect(def._state.schema).toBe(schema)
    expect(def._state.template).toBe(stubAdapter)
    expect(def._state.from).toBe('hello@example.com')
    expect(def._state.replyTo).toBe('support@example.com')
    expect(def._state.tags).toEqual({ category: 'transactional' })
    expect(def._state.priority).toBe('high')
    expect(typeof def._state.subject).toBe('function')
  })

  it('builder methods are immutable — each call returns a fresh builder', () => {
    const t = emailRpc.init()
    const a = t.email('welcome')
    const b = a.input(z.object({ name: z.string() }))
    expect(a).not.toBe(b)
    expect(a._state.schema).toBeUndefined()
    expect(b._state.schema).toBeDefined()
  })
})

describe('EmailBuilder type-level guarantees', () => {
  it('rejects calling .input() twice', () => {
    const t = emailRpc.init()
    const b = t.email('x').input(z.object({ name: z.string() }))
    // @ts-expect-error — input slot already filled
    b.input(z.object({ other: z.string() }))
  })

  it('rejects .template() before .input()', () => {
    const t = emailRpc.init()
    const adapter: TemplateAdapter<unknown> = { render: async () => ({ html: '' }) }
    // @ts-expect-error — must call .input() first
    t.email('x').template(adapter)
  })

  it('rejects calling .subject() twice', () => {
    const t = emailRpc.init()
    const b = t.email('x').input(z.object({ n: z.string() })).subject('hi')
    // @ts-expect-error — subject slot already filled
    b.subject('hi again')
  })

  it('infers subject input type from schema output', () => {
    const t = emailRpc.init()
    t.email('x')
      .input(z.object({ name: z.string(), age: z.number() }))
      .subject(({ input }) => {
        expectTypeOf(input).toEqualTypeOf<{ name: string; age: number }>()
        return `Hi ${input.name}, ${input.age}`
      })
  })

  it('infers template adapter input type from schema output', () => {
    const t = emailRpc.init()
    t.email('x')
      .input(z.object({ name: z.string() }))
      .subject('s')
      .template({
        render: async (input) => {
          expectTypeOf(input).toEqualTypeOf<{ name: string }>()
          return { html: `<p>${input.name}</p>` }
        },
      })
  })
})
