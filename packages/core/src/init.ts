import { createEmailBuilder, type EmailBuilder } from './builder.js';
import { createRouter, type EmailRouter, type ValidateRouter } from './router.js';

export type InitHooks<_Ctx> = {
  onBeforeSend?: unknown;
  onExecute?: unknown;
  onAfterSend?: unknown;
  onError?: unknown;
};

export type InitOptions<Ctx> = {
  hooks?: InitHooks<Ctx>;
};

export type RootBuilder<Ctx> = {
  email(): EmailBuilder<Ctx>;
  router<const M extends Record<string, unknown>>(map: M & ValidateRouter<M>): EmailRouter<M>;
};

export type InternalRootBuilder<Ctx> = RootBuilder<Ctx> & {
  readonly _options: Required<InitOptions<Ctx>>;
  readonly _ctx: Ctx;
};

export type EmailRpc = {
  init<Ctx = {}>(opts?: InitOptions<Ctx>): RootBuilder<Ctx>;
};

export const emailRpc: EmailRpc = {
  init<Ctx = {}>(opts: InitOptions<Ctx> = {}): RootBuilder<Ctx> {
    const options: Required<InitOptions<Ctx>> = { hooks: opts.hooks ?? {} };
    const internal: InternalRootBuilder<Ctx> = {
      email() {
        return createEmailBuilder<Ctx>({});
      },
      router<const M extends Record<string, unknown>>(map: M & ValidateRouter<M>) {
        return createRouter(map as never) as EmailRouter<M>;
      },
      _options: options,
      _ctx: undefined as Ctx,
    };
    return internal;
  },
};
