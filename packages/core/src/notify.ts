import { createCatalog, type EmailCatalog, type ValidateCatalog } from './catalog.js';
import type { AnyChannel, BuilderFor, ChannelMap } from './channel/types.js';
import type { AnyMiddleware, Middleware } from './middlewares/types.js';

export type CreateNotifyOptions<M extends ChannelMap> = {
  channels: M;
};

export type RootBuilder<M extends ChannelMap, Ctx> = {
  use<TCtxOut = Ctx>(
    middleware: Middleware<unknown, Ctx, NoInfer<TCtxOut>>,
  ): RootBuilder<M, TCtxOut>;
  catalog<const Map extends Record<string, unknown>>(
    map: Map & ValidateCatalog<Map>,
  ): EmailCatalog<Map, Ctx>;
} & {
  [K in keyof M & string]: () => BuilderFor<M[K]>;
};

const buildRoot = <M extends ChannelMap, Ctx>(
  channels: M,
  rootMiddleware: ReadonlyArray<AnyMiddleware>,
): RootBuilder<M, Ctx> => {
  const root: Record<string, unknown> = {
    use<TCtxOut = Ctx>(middleware: Middleware<unknown, Ctx, NoInfer<TCtxOut>>) {
      return buildRoot<M, TCtxOut>(channels, [...rootMiddleware, middleware as AnyMiddleware]);
    },
    catalog<const Map extends Record<string, unknown>>(map: Map & ValidateCatalog<Map>) {
      return createCatalog(map as never) as EmailCatalog<Map, Ctx>;
    },
  };
  for (const name of Object.keys(channels)) {
    const channel = channels[name] as AnyChannel;
    root[name] = () => channel.createBuilder({ ctx: undefined, rootMiddleware });
  }
  return root as RootBuilder<M, Ctx>;
};

export const createNotify = <M extends ChannelMap, Ctx = {}>(
  options: CreateNotifyOptions<M>,
): RootBuilder<M, Ctx> => buildRoot<M, Ctx>(options.channels, []);
