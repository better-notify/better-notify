import type { StandardSchemaV1 } from '@standard-schema/spec'
import { EmailRpcValidationError } from './errors.js'

export type AnyStandardSchema = StandardSchemaV1

export type InferInput<S> = S extends StandardSchemaV1<infer I, any> ? I : never
export type InferOutput<S> = S extends StandardSchemaV1<any, infer O> ? O : never

export async function validate<S extends StandardSchemaV1>(
  schema: S,
  input: unknown,
  ctx: { route?: string } = {},
): Promise<InferOutput<S>> {
  let result = schema['~standard'].validate(input)
  if (result instanceof Promise) result = await result

  if (result.issues) {
    throw new EmailRpcValidationError({
      message: `Validation failed${ctx.route ? ` for route "${ctx.route}"` : ''}`,
      issues: result.issues,
      route: ctx.route,
    })
  }
  return result.value as InferOutput<S>
}
