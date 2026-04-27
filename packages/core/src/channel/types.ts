import type { AnyStandardSchema } from '../schema.js';
import type { AnyMiddleware } from '../middlewares/types.js';

export type ChannelDefinition<TArgs, TRendered> = {
  readonly id: string;
  readonly channel: string;
  readonly schema: AnyStandardSchema;
  readonly middleware: ReadonlyArray<AnyMiddleware>;
  readonly runtime: unknown;
  readonly _args: TArgs;
  readonly _rendered: TRendered;
};

export type ChannelBuilderCtx = {
  readonly ctx: unknown;
  readonly rootMiddleware: ReadonlyArray<AnyMiddleware>;
};

export type Channel<
  TName extends string,
  TBuilder,
  TArgs,
  TRendered,
  TTransport,
> = {
  readonly name: TName;
  readonly createBuilder: (ctx: ChannelBuilderCtx) => TBuilder;
  readonly finalize: (state: unknown, id: string) => ChannelDefinition<TArgs, TRendered>;
  readonly validateArgs: (args: unknown) => TArgs | Promise<TArgs>;
  readonly render: (
    def: ChannelDefinition<TArgs, TRendered>,
    args: TArgs,
    ctx: unknown,
  ) => Promise<TRendered>;
  readonly previewRender?: (
    def: ChannelDefinition<TArgs, TRendered>,
    input: unknown,
    ctx: unknown,
  ) => Promise<unknown>;
  readonly _transport: TTransport;
};

export type AnyChannel = Channel<string, any, any, any, any>;

export type ChannelMap = Record<string, AnyChannel>;

export type TransportsFor<M extends ChannelMap> = {
  [K in keyof M]: M[K] extends Channel<any, any, any, any, infer T> ? T : never;
};

export type ArgsFor<C extends AnyChannel> = C extends Channel<any, any, infer A, any, any> ? A : never;
export type RenderedFor<C extends AnyChannel> = C extends Channel<any, any, any, infer R, any> ? R : never;
export type BuilderFor<C extends AnyChannel> = C extends Channel<any, infer B, any, any, any> ? B : never;
