import { createEmailBuilder, type EmailBuilder } from './builder.js';
import { createCatalog, type Catalog, type ValidateCatalog } from './catalog.js';
import type { AnyMiddleware, Middleware } from './middlewares/types.js';

export type RootBuilder<Ctx> = {
  email(): EmailBuilder<Ctx>;
  use<TCtxOut = Ctx>(
    middleware: Middleware<unknown, Ctx, NoInfer<TCtxOut>>,
  ): RootBuilder<TCtxOut>;
  catalog<const M extends Record<string, unknown>>(
    map: M & ValidateCatalog<M>,
  ): Catalog<M, Ctx>;
};

const buildRoot = <Ctx>(rootMiddleware: ReadonlyArray<AnyMiddleware>): RootBuilder<Ctx> => ({
  email() {
    const builder = createEmailBuilder<Ctx>({});
    if (rootMiddleware.length === 0) return builder;
    const seeded = builder as unknown as {
      _state: { middleware: ReadonlyArray<AnyMiddleware> };
    };
    seeded._state = { ...seeded._state, middleware: [...rootMiddleware] };
    return builder;
  },
  use<TCtxOut = Ctx>(middleware: Middleware<unknown, Ctx, NoInfer<TCtxOut>>) {
    return buildRoot<TCtxOut>([...rootMiddleware, middleware as AnyMiddleware]);
  },
  catalog<const M extends Record<string, unknown>>(map: M & ValidateCatalog<M>) {
    return createCatalog(map as never) as Catalog<M, Ctx>;
  },
});

export const createEmailRpc = <Ctx = {}>(): RootBuilder<Ctx> => buildRoot<Ctx>([]);
