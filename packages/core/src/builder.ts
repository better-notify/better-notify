import type { AnyStandardSchema, InferOutput } from './schema.js'
import type { TemplateAdapter } from './template.js'
import type { Address, Priority, Tags } from './types.js'

export type SubjectResolver<TInput> = string | ((args: { input: TInput }) => string)

export interface EmailDefinition<
  Ctx,
  Id extends string,
  TSchema extends AnyStandardSchema,
  TAdapter extends TemplateAdapter<InferOutput<TSchema>>,
> {
  readonly _ctx: Ctx
  readonly id: Id
  readonly schema: TSchema
  readonly subject: SubjectResolver<InferOutput<TSchema>>
  readonly template: TAdapter
  readonly from: Address | undefined
  readonly replyTo: Address | undefined
  readonly tags: Tags
  readonly priority: Priority
}

interface Slots {
  input?: AnyStandardSchema
  subject?: unknown
  template?: unknown
  from?: Address
  replyTo?: Address
  tags?: Tags
  priority?: Priority
}

type Has<S extends Slots, K extends keyof Slots> = K extends keyof S
  ? S[K] extends undefined
    ? false
    : true
  : false

type SetSlot<S extends Slots, K extends keyof Slots, V> = Omit<S, K> & { [P in K]: V }

type RequireSlots<S extends Slots> = Has<S, 'input'> extends true
  ? Has<S, 'subject'> extends true
    ? Has<S, 'template'> extends true
      ? true
      : false
    : false
  : false

type CompleteSchema<S extends Slots> = S['input'] extends AnyStandardSchema ? S['input'] : never
type CompleteAdapter<S extends Slots> = S['template'] extends TemplateAdapter<any>
  ? S['template']
  : never

export interface InternalBuilderState {
  ctx: unknown
  id: string
  schema: AnyStandardSchema | undefined
  subject: SubjectResolver<unknown> | undefined
  template: TemplateAdapter<unknown> | undefined
  from: Address | undefined
  replyTo: Address | undefined
  tags: Tags
  priority: Priority
}

export class EmailBuilder<Ctx, Id extends string, S extends Slots = {}> {
  /** Internal state. Marked underscored so consumers don't reach for it. */
  readonly _state: InternalBuilderState
  /** Phantom: brands the type so the router can detect EmailBuilder values. */
  declare readonly _brand: 'EmailBuilder'
  declare readonly _ctx: Ctx
  declare readonly _id: Id
  declare readonly _slots: S

  constructor(state: InternalBuilderState) {
    this._state = state
  }

  input<TSchema extends AnyStandardSchema>(
    schema: Has<S, 'input'> extends true ? never : TSchema,
  ): EmailBuilder<Ctx, Id, SetSlot<S, 'input', TSchema>> {
    return new EmailBuilder({ ...this._state, schema: schema as AnyStandardSchema })
  }

  subject(
    resolver: Has<S, 'subject'> extends true
      ? never
      : Has<S, 'input'> extends true
        ? SubjectResolver<InferOutput<CompleteSchema<S>>>
        : SubjectResolver<unknown>,
  ): EmailBuilder<Ctx, Id, SetSlot<S, 'subject', typeof resolver>> {
    return new EmailBuilder({
      ...this._state,
      subject: resolver as SubjectResolver<unknown>,
    })
  }

  template<A extends TemplateAdapter<InferOutput<CompleteSchema<S>>>>(
    adapter: Has<S, 'template'> extends true
      ? never
      : Has<S, 'input'> extends true
        ? A
        : never,
  ): EmailBuilder<Ctx, Id, SetSlot<S, 'template', A>> {
    return new EmailBuilder({
      ...this._state,
      template: adapter as TemplateAdapter<unknown>,
    })
  }

  from(address: Has<S, 'from'> extends true ? never : Address): EmailBuilder<Ctx, Id, SetSlot<S, 'from', Address>> {
    return new EmailBuilder({ ...this._state, from: address })
  }

  replyTo(
    address: Has<S, 'replyTo'> extends true ? never : Address,
  ): EmailBuilder<Ctx, Id, SetSlot<S, 'replyTo', Address>> {
    return new EmailBuilder({ ...this._state, replyTo: address })
  }

  tags(tags: Has<S, 'tags'> extends true ? never : Tags): EmailBuilder<Ctx, Id, SetSlot<S, 'tags', Tags>> {
    return new EmailBuilder({ ...this._state, tags: { ...this._state.tags, ...tags } })
  }

  priority(
    p: Has<S, 'priority'> extends true ? never : Priority,
  ): EmailBuilder<Ctx, Id, SetSlot<S, 'priority', Priority>> {
    return new EmailBuilder({ ...this._state, priority: p })
  }
}

/**
 * Structural brand-only type for "any EmailBuilder". Avoids the class method
 * invariance problem where `EmailBuilder<Ctx, Id, ConcreteSlots>` is not
 * assignable to `EmailBuilder<any, string, Slots>` due to method-return
 * variance — relevant when EmailBuilder values flow through generic constraints.
 */
export interface AnyEmailBuilder {
  readonly _brand: 'EmailBuilder'
  readonly _state: InternalBuilderState
}

export type CompleteEmailBuilder<Ctx = any, Id extends string = string> = EmailBuilder<
  Ctx,
  Id,
  Slots & { input: AnyStandardSchema; subject: unknown; template: TemplateAdapter<any> }
>

export type IsComplete<B> = B extends EmailBuilder<any, any, infer S>
  ? RequireSlots<S> extends true
    ? true
    : false
  : false

export type EmailDefinitionOf<B> = B extends EmailBuilder<infer Ctx, infer Id, infer S>
  ? S extends { input: infer TSchema; template: infer TAdapter }
    ? TSchema extends AnyStandardSchema
      ? TAdapter extends TemplateAdapter<InferOutput<TSchema>>
        ? EmailDefinition<Ctx, Id & string, TSchema, TAdapter>
        : never
      : never
    : never
  : never

/** @internal */
export function createEmailBuilder<Ctx, Id extends string>(
  ctx: { context?: Ctx },
  id: Id,
): EmailBuilder<Ctx, Id> {
  return new EmailBuilder<Ctx, Id>({
    ctx: ctx.context,
    id,
    schema: undefined,
    subject: undefined,
    template: undefined,
    from: undefined,
    replyTo: undefined,
    tags: {},
    priority: 'normal',
  })
}

export type { Slots, CompleteSchema, CompleteAdapter, RequireSlots, Has, SetSlot }
