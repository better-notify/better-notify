import type {
  AnyMiddleware,
  Middleware,
  AnyStandardSchema,
  InferOutput,
  ChannelDefinition,
} from '@emailrpc/core';
import type { RenderedSms, SmsSendArgs } from './types.js';

type Slots = { input?: AnyStandardSchema; body?: unknown };

type Has<S extends Slots, K extends keyof Slots> = K extends keyof S
  ? S[K] extends undefined
    ? false
    : true
  : false;

type SetSlot<S extends Slots, K extends keyof Slots, V> = Omit<S, K> & { [P in K]: V };

type CompleteSchema<S extends Slots> = S['input'] extends AnyStandardSchema ? S['input'] : never;

export type BodyResolver<TInput> = string | ((args: { input: TInput }) => string);

type State = {
  ctx: unknown;
  schema: AnyStandardSchema | undefined;
  body: BodyResolver<unknown> | undefined;
  middleware: ReadonlyArray<AnyMiddleware>;
};

export class SmsBuilder<Ctx, S extends Slots = {}> {
  readonly _state: State;
  declare readonly _ctx: Ctx;
  declare readonly _slots: S;
  declare readonly _args: SmsSendArgs<InferOutput<CompleteSchema<S>>>;
  declare readonly _rendered: RenderedSms;
  readonly _channel = 'sms' as const;

  constructor(state: State) {
    this._state = state;
  }

  use<TCtxOut = Ctx>(mw: Middleware<unknown, Ctx, NoInfer<TCtxOut>>): SmsBuilder<TCtxOut, S> {
    return new SmsBuilder<TCtxOut, S>({
      ...this._state,
      middleware: [...this._state.middleware, mw as AnyMiddleware],
    });
  }

  input<TSchema extends AnyStandardSchema>(
    schema: Has<S, 'input'> extends true ? never : TSchema,
  ): SmsBuilder<Ctx, SetSlot<S, 'input', TSchema>> {
    return new SmsBuilder({ ...this._state, schema: schema as AnyStandardSchema });
  }

  body(
    resolver: Has<S, 'body'> extends true ? never : BodyResolver<InferOutput<CompleteSchema<S>>>,
  ): SmsBuilder<Ctx, SetSlot<S, 'body', typeof resolver>> {
    return new SmsBuilder({ ...this._state, body: resolver as BodyResolver<unknown> });
  }

  _finalize(id: string): ChannelDefinition<SmsSendArgs<unknown>, RenderedSms> {
    if (!this._state.schema || !this._state.body) {
      throw new Error(`SMS "${id}" is incomplete: input and body are required.`);
    }
    return {
      id,
      channel: 'sms',
      schema: this._state.schema,
      middleware: this._state.middleware,
      runtime: { body: this._state.body },
      _args: undefined as never,
      _rendered: undefined as never,
    };
  }
}

export const createSmsBuilder = <Ctx>(opts: { context?: Ctx }): SmsBuilder<Ctx> =>
  new SmsBuilder({
    ctx: opts.context,
    schema: undefined,
    body: undefined,
    middleware: [],
  });
