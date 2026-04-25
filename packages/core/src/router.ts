import type { AnyStandardSchema, InferInput, InferOutput } from './schema.js'
import type { TemplateAdapter } from './template.js'
import type { EmailBuilder, EmailDefinitionOf } from './builder.js'

/**
 * Type-level validator: each value of M must be a complete EmailBuilder.
 * - If complete (input + subject + template all set), the value passes through unchanged.
 * - Otherwise, it's swapped for a literal-string error type whose name a real
 *   EmailBuilder cannot satisfy, so the assignment site reports the error.
 */
export type ValidateRouter<M> = {
  [K in keyof M]: M[K] extends EmailBuilder<any, any, infer S>
    ? S extends { input: AnyStandardSchema; subject: unknown; template: TemplateAdapter<any> }
      ? M[K]
      : `Email "${K & string}" is incomplete: input, subject, and template are required.`
    : `Value at "${K & string}" is not an EmailBuilder.`
}

export interface EmailRouter<M> {
  readonly _brand: 'EmailRouter'
  readonly emails: { readonly [K in keyof M]: EmailDefinitionOf<M[K]> }
  readonly routes: ReadonlyArray<keyof M & string>
}

export type AnyEmailRouter = EmailRouter<Record<string, unknown>>

/**
 * Build a router from a map of completed email builders.
 *
 * Compile-time guarantee: every value must be an `EmailBuilder` with
 * `input`, `subject`, and `template` slots filled.
 */
export function createRouter<const M extends Record<string, unknown>>(
  map: M & ValidateRouter<M>,
): EmailRouter<M> {
  const emails = {} as { [K in keyof M]: EmailDefinitionOf<M[K]> }
  for (const key of Object.keys(map) as (keyof M & string)[]) {
    const builder = map[key] as { _state?: { schema?: unknown; subject?: unknown; template?: unknown; from?: unknown; replyTo?: unknown; tags?: unknown; priority?: unknown } }
    const state = builder._state
    if (!state || !state.schema || !state.subject || !state.template) {
      throw new Error(`Email "${key}" is incomplete: input/subject/template are required.`)
    }
    emails[key] = {
      _ctx: undefined as never,
      id: key,
      schema: state.schema,
      subject: state.subject,
      template: state.template,
      from: state.from,
      replyTo: state.replyTo,
      tags: state.tags,
      priority: state.priority,
    } as EmailDefinitionOf<M[typeof key]>
  }
  return {
    _brand: 'EmailRouter',
    emails,
    routes: Object.keys(map) as (keyof M & string)[],
  }
}

type SchemaOf<B> = B extends EmailBuilder<any, any, infer S>
  ? S extends { input: infer TSchema }
    ? TSchema extends AnyStandardSchema
      ? TSchema
      : never
    : never
  : never

/** Extract the input type for a given route id from a router. */
export type InputOf<R extends EmailRouter<any>, K extends keyof RouterOf<R>> =
  InferInput<SchemaOf<RouterOf<R>[K]>>

/** Extract the parsed (output) type for a given route id from a router. */
export type OutputOf<R extends EmailRouter<any>, K extends keyof RouterOf<R>> =
  InferOutput<SchemaOf<RouterOf<R>[K]>>

type RouterOf<R> = R extends EmailRouter<infer M> ? M : never

/** Backwards-compat alias used internally — any value-position key map. */
export type RouterMap = Record<string, unknown>
