import type { AnyStandardSchema, InferOutput } from '../schema.js';
import { validate } from '../schema.js';
import type { AnyMiddleware, Middleware } from '../middlewares/types.js';
import type { Transport } from '../transport.js';
import type { Channel, ChannelBuilderCtx, ChannelDefinition } from './types.js';

export type ResolverSlot<TValue> = TValue | ((args: { input: any; ctx: unknown }) => TValue);

export type SlotKind = 'resolver' | 'value';

export type SlotConfig<K extends SlotKind = SlotKind> = { kind: K; required: boolean };

export type SlotMap = Record<string, SlotConfig>;

type SlotValueType<S, TValue, TInput> = S extends { kind: 'resolver' }
  ? TValue | ((args: { input: TInput; ctx: unknown }) => TValue)
  : TValue;

type SlotRuntimeType<S, TValue> = S extends { required: false } ? TValue | undefined : TValue;

type ArgsBase<TArgs> = TArgs extends { input: any } ? Omit<TArgs, 'input'> : TArgs;

export type ChannelBuilder<
  TInput,
  TSlotValues extends Record<string, unknown>,
  TSlotConfig extends SlotMap,
  TArgsBase,
  TRendered,
> = {
  readonly _channel: string;
  readonly _state: BuilderState;
  readonly _args: TArgsBase & { input: TInput };
  readonly _rendered: TRendered;
  input<TSchema extends AnyStandardSchema>(
    schema: TSchema,
  ): ChannelBuilder<InferOutput<TSchema>, TSlotValues, TSlotConfig, TArgsBase, TRendered>;
  use<TCtxOut = unknown>(
    middleware: Middleware<TInput, unknown, TCtxOut>,
  ): ChannelBuilder<TInput, TSlotValues, TSlotConfig, TArgsBase, TRendered>;
  _finalize(id: string): ChannelDefinition<TArgsBase & { input: TInput }, TRendered>;
} & {
  [K in keyof TSlotValues & keyof TSlotConfig & string]: (
    value: SlotValueType<TSlotConfig[K], TSlotValues[K], TInput>,
  ) => ChannelBuilder<TInput, TSlotValues, TSlotConfig, TArgsBase, TRendered>;
};

type BuilderState = {
  schema: AnyStandardSchema | undefined;
  middleware: ReadonlyArray<AnyMiddleware>;
  runtime: Record<string, unknown>;
};

type ValueOf<S> = S extends { __value?: infer V } ? V : unknown;

type SlotValuesOf<S extends SlotMap> = { [K in keyof S]: ValueOf<S[K]> };

type ArgsFromValidator<V> = V extends AnyStandardSchema
  ? InferOutput<V>
  : V extends (args: unknown) => infer R
    ? Awaited<R>
    : never;

type WithInput<TArgs> = TArgs extends { input: any } ? TArgs : TArgs & { input: unknown };

export type DefineChannelOptions<
  TName extends string,
  TValidator,
  TRendered,
  TSlotConfig extends SlotMap,
> = {
  readonly name: TName;
  readonly slots: TSlotConfig;
  readonly validateArgs: TValidator;
  readonly render: (params: {
    runtime: { [K in keyof TSlotConfig]: SlotRuntimeType<TSlotConfig[K], ValueOf<TSlotConfig[K]>> };
    args: WithInput<ArgsFromValidator<TValidator>>;
    ctx: unknown;
  }) => Promise<TRendered> | TRendered;
  readonly previewRender?: (params: {
    runtime: { [K in keyof TSlotConfig]: SlotRuntimeType<TSlotConfig[K], ValueOf<TSlotConfig[K]>> };
    input: unknown;
    ctx: unknown;
  }) => Promise<unknown> | unknown;
};

const isStandardSchema = (v: unknown): v is AnyStandardSchema =>
  !!v && typeof v === 'object' && '~standard' in v;

const resolveRuntime = (
  rawRuntime: Record<string, unknown>,
  slots: SlotMap,
  input: unknown,
  ctx: unknown,
): Record<string, unknown> => {
  const resolved: Record<string, unknown> = {};
  for (const [key, config] of Object.entries(slots)) {
    const raw = rawRuntime[key];
    if (config.kind === 'resolver' && typeof raw === 'function') {
      resolved[key] = (raw as (a: { input: unknown; ctx: unknown }) => unknown)({ input, ctx });
    } else {
      resolved[key] = raw;
    }
  }
  return resolved;
};

const buildBuilder = <
  TInput,
  TSlotValues extends Record<string, unknown>,
  TSlotConfig extends SlotMap,
  TArgsBase,
  TRendered,
>(
  channelName: string,
  slots: TSlotConfig,
  state: BuilderState,
): ChannelBuilder<TInput, TSlotValues, TSlotConfig, TArgsBase, TRendered> => {
  const next = (
    patch: Partial<BuilderState>,
  ): ChannelBuilder<TInput, TSlotValues, TSlotConfig, TArgsBase, TRendered> =>
    buildBuilder<TInput, TSlotValues, TSlotConfig, TArgsBase, TRendered>(channelName, slots, {
      ...state,
      ...patch,
      runtime: { ...state.runtime, ...patch.runtime },
    });

  const builder: Record<string | symbol, unknown> = {
    _channel: channelName,
    _state: state,
    _args: undefined,
    _rendered: undefined,
    input<TSchema extends AnyStandardSchema>(schema: TSchema) {
      if (state.schema) throw new Error(`Slot "input" already set on channel "${channelName}".`);
      return next({ schema: schema as AnyStandardSchema });
    },
    use(mw: AnyMiddleware) {
      return next({ middleware: [...state.middleware, mw] });
    },
    _finalize(id: string): ChannelDefinition<TArgsBase & { input: TInput }, TRendered> {
      if (!state.schema) {
        throw new Error(`Channel "${channelName}" route "${id}" missing required slot: input.`);
      }
      for (const key of Object.keys(slots)) {
        if (slots[key]?.required && state.runtime[key] === undefined) {
          throw new Error(`Channel "${channelName}" route "${id}" missing required slot: ${key}.`);
        }
      }
      return {
        id,
        channel: channelName,
        schema: state.schema,
        middleware: state.middleware,
        runtime: state.runtime,
        _args: undefined as never,
        _rendered: undefined as never,
      };
    },
  };

  for (const key of Object.keys(slots)) {
    builder[key] = (value: unknown) => {
      if (state.runtime[key] !== undefined) {
        throw new Error(`Slot "${key}" already set on channel "${channelName}".`);
      }
      return next({ runtime: { [key]: value } });
    };
  }

  return builder as ChannelBuilder<TInput, TSlotValues, TSlotConfig, TArgsBase, TRendered>;
};

export const defineChannel = <
  TName extends string,
  TValidator,
  TRendered,
  TSlotConfig extends SlotMap,
>(
  opts: DefineChannelOptions<TName, TValidator, TRendered, TSlotConfig>,
): Channel<
  TName,
  ChannelBuilder<
    unknown,
    SlotValuesOf<TSlotConfig>,
    TSlotConfig,
    ArgsBase<ArgsFromValidator<TValidator>>,
    TRendered
  >,
  ArgsFromValidator<TValidator>,
  TRendered,
  Transport<TRendered, unknown>
> => ({
  name: opts.name,
  createBuilder: (ctx: ChannelBuilderCtx) =>
    buildBuilder<
      unknown,
      SlotValuesOf<TSlotConfig>,
      TSlotConfig,
      ArgsBase<ArgsFromValidator<TValidator>>,
      TRendered
    >(opts.name, opts.slots, {
      schema: undefined,
      middleware: [...ctx.rootMiddleware],
      runtime: {},
    }),
  finalize: (state, id) =>
    (
      state as ChannelBuilder<
        unknown,
        SlotValuesOf<TSlotConfig>,
        TSlotConfig,
        ArgsBase<ArgsFromValidator<TValidator>>,
        TRendered
      >
    )._finalize(id) as ChannelDefinition<ArgsFromValidator<TValidator>, TRendered>,
  validateArgs: isStandardSchema(opts.validateArgs)
    ? async (args: unknown) => {
        const validated = (await validate(opts.validateArgs as AnyStandardSchema, args, {
          route: opts.name,
        })) as Record<string, unknown>;
        const inputField =
          args && typeof args === 'object' && 'input' in args
            ? (args as { input: unknown }).input
            : undefined;
        return { input: inputField, ...validated } as ArgsFromValidator<TValidator>;
      }
    : (opts.validateArgs as (
        args: unknown,
      ) => ArgsFromValidator<TValidator> | Promise<ArgsFromValidator<TValidator>>),
  render: async (def, args, ctx) => {
    const runtime = resolveRuntime(
      def.runtime as Record<string, unknown>,
      opts.slots,
      (args as { input: unknown }).input,
      ctx,
    ) as { [K in keyof TSlotConfig]: SlotRuntimeType<TSlotConfig[K], ValueOf<TSlotConfig[K]>> };
    return opts.render({ runtime, args: args as WithInput<ArgsFromValidator<TValidator>>, ctx });
  },
  previewRender: opts.previewRender
    ? ((_fn) => async (def: ChannelDefinition<unknown, unknown>, input: unknown, ctx: unknown) => {
        const runtime = resolveRuntime(
          def.runtime as Record<string, unknown>,
          opts.slots,
          input,
          ctx,
        ) as never;
        return _fn({ runtime, input, ctx });
      })(opts.previewRender)
    : undefined,
  _transport: undefined as never,
});

type ResolverSlotSpec<TValue, R extends boolean> = SlotConfig<'resolver'> & {
  required: R;
  __value?: TValue;
  optional: () => ResolverSlotSpec<TValue, false>;
};

type ValueSlotSpec<TValue, R extends boolean> = SlotConfig<'value'> & {
  required: R;
  __value?: TValue;
  optional: () => ValueSlotSpec<TValue, false>;
};

const makeResolverSlot = <TValue, R extends boolean>(required: R): ResolverSlotSpec<TValue, R> => ({
  kind: 'resolver',
  required,
  optional: () => makeResolverSlot<TValue, false>(false),
});

const makeValueSlot = <TValue, R extends boolean>(required: R): ValueSlotSpec<TValue, R> => ({
  kind: 'value',
  required,
  optional: () => makeValueSlot<TValue, false>(false),
});

export const slot = {
  resolver: <TValue>(): ResolverSlotSpec<TValue, true> => makeResolverSlot<TValue, true>(true),
  value: <TValue>(): ValueSlotSpec<TValue, true> => makeValueSlot<TValue, true>(true),
};
