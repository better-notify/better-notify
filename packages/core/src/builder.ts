import type { AnyMiddleware, Middleware } from './middlewares/types.js';
import type { AnyStandardSchema, InferOutput } from './schema.js';
import type { RenderedOutput, TemplateAdapter } from './template.js';
import type { Address, FromInput, Priority, Tags } from './types.js';

export type SubjectResolver<TInput> = string | ((args: { input: TInput }) => string);

export type EmailDefinition<
  Ctx,
  TSchema extends AnyStandardSchema,
  TAdapter extends TemplateAdapter<InferOutput<TSchema>, any>,
> = {
  readonly _ctx: Ctx;
  readonly id: string;
  readonly schema: TSchema;
  readonly subject: SubjectResolver<InferOutput<TSchema>>;
  readonly template: TAdapter;
  readonly from: FromInput | undefined;
  readonly replyTo: Address | undefined;
  readonly tags: Tags;
  readonly priority: Priority;
  readonly middleware: ReadonlyArray<AnyMiddleware>;
};

type Slots = {
  input?: AnyStandardSchema;
  subject?: unknown;
  template?: unknown;
  from?: FromInput;
  replyTo?: Address;
  tags?: Tags;
  priority?: Priority;
};

type Has<S extends Slots, K extends keyof Slots> = K extends keyof S
  ? S[K] extends undefined
    ? false
    : true
  : false;

type SetSlot<S extends Slots, K extends keyof Slots, V> = Omit<S, K> & {
  [P in K]: V;
};

type RequireSlots<S extends Slots> =
  Has<S, 'input'> extends true
    ? Has<S, 'subject'> extends true
      ? Has<S, 'template'> extends true
        ? true
        : false
      : false
    : false;

type InputForSlots<S extends Slots> =
  S['input'] extends AnyStandardSchema ? InferOutput<S['input']> : unknown;

type CompleteSchema<S extends Slots> = S['input'] extends AnyStandardSchema ? S['input'] : never;
type CompleteAdapter<S extends Slots> =
  S['template'] extends TemplateAdapter<any, any> ? S['template'] : never;

export type InternalBuilderState = {
  ctx: unknown;
  schema: AnyStandardSchema | undefined;
  subject: SubjectResolver<unknown> | undefined;
  template: TemplateAdapter<unknown, any> | undefined;
  from: FromInput | undefined;
  replyTo: Address | undefined;
  tags: Tags;
  priority: Priority;
  middleware: ReadonlyArray<AnyMiddleware>;
};

export class EmailBuilder<Ctx, S extends Slots = {}> {
  readonly _state: InternalBuilderState;
  declare readonly _brand: 'EmailBuilder';
  declare readonly _ctx: Ctx;
  declare readonly _slots: S;

  constructor(state: InternalBuilderState) {
    this._state = state;
  }

  use<TCtxOut = Ctx>(
    middleware: Middleware<InputForSlots<S>, Ctx, NoInfer<TCtxOut>>,
  ): EmailBuilder<TCtxOut, S> {
    return new EmailBuilder<TCtxOut, S>({
      ...this._state,
      middleware: [...this._state.middleware, middleware as AnyMiddleware],
    });
  }

  input<TSchema extends AnyStandardSchema>(
    schema: Has<S, 'input'> extends true ? never : TSchema,
  ): EmailBuilder<Ctx, SetSlot<S, 'input', TSchema>> {
    return new EmailBuilder({
      ...this._state,
      schema: schema as AnyStandardSchema,
    });
  }

  subject(
    resolver: Has<S, 'subject'> extends true
      ? never
      : Has<S, 'input'> extends true
        ? SubjectResolver<InferOutput<CompleteSchema<S>>>
        : SubjectResolver<unknown>,
  ): EmailBuilder<Ctx, SetSlot<S, 'subject', typeof resolver>> {
    return new EmailBuilder({
      ...this._state,
      subject: resolver as SubjectResolver<unknown>,
    });
  }

  template<A extends TemplateAdapter<InferOutput<CompleteSchema<S>>, Ctx>>(
    adapter: Has<S, 'template'> extends true
      ? never
      : Has<S, 'input'> extends true
        ?
            | A
            | ((args: {
                input: InferOutput<CompleteSchema<S>>;
                ctx: Ctx;
              }) => RenderedOutput | Promise<RenderedOutput>)
        : never,
  ): EmailBuilder<Ctx, SetSlot<S, 'template', A>> {
    const normalized: TemplateAdapter<unknown, any> =
      typeof adapter === 'function'
        ? {
            render: async (args: { input: unknown; ctx: any }) =>
              (
                adapter as (a: {
                  input: unknown;
                  ctx: any;
                }) => RenderedOutput | Promise<RenderedOutput>
              )(args),
          }
        : (adapter as TemplateAdapter<unknown, any>);
    return new EmailBuilder<Ctx, SetSlot<S, 'template', A>>({
      ...this._state,
      template: normalized,
    });
  }

  from(
    input: Has<S, 'from'> extends true ? never : FromInput,
  ): EmailBuilder<Ctx, SetSlot<S, 'from', FromInput>> {
    return new EmailBuilder({ ...this._state, from: input });
  }

  replyTo(
    address: Has<S, 'replyTo'> extends true ? never : Address,
  ): EmailBuilder<Ctx, SetSlot<S, 'replyTo', Address>> {
    return new EmailBuilder({ ...this._state, replyTo: address });
  }

  tags(
    tags: Has<S, 'tags'> extends true ? never : Tags,
  ): EmailBuilder<Ctx, SetSlot<S, 'tags', Tags>> {
    return new EmailBuilder({ ...this._state, tags });
  }

  priority(
    p: Has<S, 'priority'> extends true ? never : Priority,
  ): EmailBuilder<Ctx, SetSlot<S, 'priority', Priority>> {
    return new EmailBuilder({ ...this._state, priority: p });
  }
}

export type AnyEmailBuilder = {
  readonly _brand: 'EmailBuilder';
  readonly _state: InternalBuilderState;
};

export type CompleteEmailBuilder<Ctx = any> = EmailBuilder<
  Ctx,
  Slots & {
    input: AnyStandardSchema;
    subject: unknown;
    template: TemplateAdapter<any, any>;
  }
>;

export type IsComplete<B> =
  B extends EmailBuilder<any, infer S> ? (RequireSlots<S> extends true ? true : false) : false;

export type EmailDefinitionOf<B> =
  B extends EmailBuilder<infer Ctx, infer S>
    ? S extends { input: infer TSchema; template: infer TAdapter }
      ? TSchema extends AnyStandardSchema
        ? TAdapter extends TemplateAdapter<InferOutput<TSchema>, any>
          ? EmailDefinition<Ctx, TSchema, TAdapter>
          : never
        : never
      : never
    : never;

export const createEmailBuilder = <Ctx>(ctx: { context?: Ctx }): EmailBuilder<Ctx> => {
  return new EmailBuilder<Ctx>({
    ctx: ctx.context,
    schema: undefined,
    subject: undefined,
    template: undefined,
    from: undefined,
    replyTo: undefined,
    tags: {},
    priority: 'normal',
    middleware: [],
  });
};

export type { Slots, CompleteSchema, CompleteAdapter, RequireSlots, Has, SetSlot };
