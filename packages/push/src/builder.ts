import type {
  AnyMiddleware,
  Middleware,
  AnyStandardSchema,
  InferOutput,
  ChannelDefinition,
} from '@emailrpc/core';
import type { RenderedPush, PushSendArgs } from './types.js';

type Slots = { input?: AnyStandardSchema; title?: unknown; body?: unknown };

type Has<S extends Slots, K extends keyof Slots> = K extends keyof S
  ? S[K] extends undefined
    ? false
    : true
  : false;

type SetSlot<S extends Slots, K extends keyof Slots, V> = Omit<S, K> & { [P in K]: V };

type CompleteSchema<S extends Slots> = S['input'] extends AnyStandardSchema ? S['input'] : never;

export type TitleResolver<TInput> = string | ((args: { input: TInput }) => string);
export type BodyResolver<TInput> = string | ((args: { input: TInput }) => string);
export type DataResolver<TInput> = Record<string, unknown> | ((args: { input: TInput }) => Record<string, unknown>);
export type BadgeResolver<TInput> = number | ((args: { input: TInput }) => number);

type State = {
  ctx: unknown;
  schema: AnyStandardSchema | undefined;
  title: TitleResolver<unknown> | undefined;
  body: BodyResolver<unknown> | undefined;
  data: DataResolver<unknown> | undefined;
  badge: BadgeResolver<unknown> | undefined;
  middleware: ReadonlyArray<AnyMiddleware>;
};

export class PushBuilder<Ctx, S extends Slots = {}> {
  readonly _state: State;
  declare readonly _ctx: Ctx;
  declare readonly _slots: S;
  declare readonly _args: PushSendArgs<InferOutput<CompleteSchema<S>>>;
  declare readonly _rendered: RenderedPush;
  readonly _channel = 'push' as const;

  constructor(state: State) {
    this._state = state;
  }

  use<TCtxOut = Ctx>(mw: Middleware<unknown, Ctx, NoInfer<TCtxOut>>): PushBuilder<TCtxOut, S> {
    return new PushBuilder<TCtxOut, S>({
      ...this._state,
      middleware: [...this._state.middleware, mw as AnyMiddleware],
    });
  }

  input<TSchema extends AnyStandardSchema>(
    schema: Has<S, 'input'> extends true ? never : TSchema,
  ): PushBuilder<Ctx, SetSlot<S, 'input', TSchema>> {
    return new PushBuilder({ ...this._state, schema: schema as AnyStandardSchema });
  }

  title(
    resolver: Has<S, 'title'> extends true ? never : TitleResolver<InferOutput<CompleteSchema<S>>>,
  ): PushBuilder<Ctx, SetSlot<S, 'title', typeof resolver>> {
    return new PushBuilder({ ...this._state, title: resolver as TitleResolver<unknown> });
  }

  body(
    resolver: Has<S, 'body'> extends true ? never : BodyResolver<InferOutput<CompleteSchema<S>>>,
  ): PushBuilder<Ctx, SetSlot<S, 'body', typeof resolver>> {
    return new PushBuilder({ ...this._state, body: resolver as BodyResolver<unknown> });
  }

  data(
    resolver: DataResolver<InferOutput<CompleteSchema<S>>>,
  ): PushBuilder<Ctx, S> {
    return new PushBuilder({ ...this._state, data: resolver as DataResolver<unknown> });
  }

  badge(
    resolver: BadgeResolver<InferOutput<CompleteSchema<S>>>,
  ): PushBuilder<Ctx, S> {
    return new PushBuilder({ ...this._state, badge: resolver as BadgeResolver<unknown> });
  }

  _finalize(id: string): ChannelDefinition<PushSendArgs<unknown>, RenderedPush> {
    if (!this._state.schema || !this._state.title || !this._state.body) {
      throw new Error(`Push "${id}" is incomplete: input, title, and body are required.`);
    }
    return {
      id,
      channel: 'push',
      schema: this._state.schema,
      middleware: this._state.middleware,
      runtime: {
        title: this._state.title,
        body: this._state.body,
        data: this._state.data,
        badge: this._state.badge,
      },
      _args: undefined as never,
      _rendered: undefined as never,
    };
  }
}

export const createPushBuilder = <Ctx>(opts: { context?: Ctx }): PushBuilder<Ctx> =>
  new PushBuilder({
    ctx: opts.context,
    schema: undefined,
    title: undefined,
    body: undefined,
    data: undefined,
    badge: undefined,
    middleware: [],
  });
