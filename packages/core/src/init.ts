import { createEmailBuilder, type EmailBuilder } from './builder.js'
import { createRouter, type EmailRouter, type ValidateRouter } from './router.js'

/**
 * Hooks accepted at init time. Stored on the builder for the (future) sender
 * runtime to consume. Layer 1 records them but does not execute them — the
 * sender lives in Layer 2.
 */
export interface InitHooks<_Ctx> {
  onBeforeSend?: unknown
  onExecute?: unknown
  onAfterSend?: unknown
  onError?: unknown
}

export interface InitOptions<Ctx> {
  hooks?: InitHooks<Ctx>
}

export interface RootBuilder<Ctx> {
  /** Define a single email contract by route id. */
  email<Id extends string>(id: Id): EmailBuilder<Ctx, Id>
  /** Compose a typed router from a map of completed email builders. */
  router<const M extends Record<string, unknown>>(map: M & ValidateRouter<M>): EmailRouter<M>
  /** Read the recorded init options (for adapters / sender runtime). */
  readonly _options: Required<InitOptions<Ctx>>
  /** @internal */
  readonly _ctx: Ctx
}

export interface EmailRpc {
  init<Ctx = {}>(opts?: InitOptions<Ctx>): RootBuilder<Ctx>
}

export const emailRpc: EmailRpc = {
  init<Ctx = {}>(opts: InitOptions<Ctx> = {}): RootBuilder<Ctx> {
    const options: Required<InitOptions<Ctx>> = { hooks: opts.hooks ?? {} }
    return {
      email<Id extends string>(id: Id) {
        return createEmailBuilder<Ctx, Id>({}, id)
      },
      router<const M extends Record<string, unknown>>(map: M & ValidateRouter<M>) {
        return createRouter(map as never) as EmailRouter<M>
      },
      _options: options,
      _ctx: undefined as Ctx,
    }
  },
}
