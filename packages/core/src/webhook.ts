import { NotifyRpcNotImplementedError } from './errors.js';
import type { AnyStandardSchema, InferOutput } from './schema.js';

/** @experimental Layer 6 webhook router — not yet implemented; ships in v0.3. */
export type WebhookHandler<TSchema extends AnyStandardSchema, TCtx> = {
  (params: { input: InferOutput<TSchema>; ctx: TCtx }): Promise<void> | void;
};

/** @experimental Layer 6 webhook router — not yet implemented; ships in v0.3. */
export type WebhookDefinition<TSchema extends AnyStandardSchema, TCtx> = {
  schema: TSchema;
  handler: WebhookHandler<TSchema, TCtx>;
};

/** @experimental Layer 6 webhook router — not yet implemented; ships in v0.3. */
export type WebhookRouter = {
  readonly _brand: 'WebhookRouter';
  readonly handlers: Record<string, WebhookDefinition<AnyStandardSchema, unknown>>;
};

/** @experimental Layer 6 webhook router — not yet implemented; ships in v0.3. */
export type WebhookAdapter = {
  name: string;
  parse(
    payload: unknown,
    headers: Record<string, string>,
  ): Promise<{ event: string; data: unknown }>;
  verify?(payload: unknown, headers: Record<string, string>): Promise<boolean>;
};

/** @experimental Layer 6 webhook router — not yet implemented; ships in v0.3. */
export const toNodeHandler = (
  _router: WebhookRouter,
  _opts: { adapter: WebhookAdapter },
): never => {
  throw new NotifyRpcNotImplementedError('toNodeHandler() (Layer 6)');
};

/** @experimental Layer 6 webhook router — not yet implemented; ships in v0.3. */
export const toFetchHandler = (
  _router: WebhookRouter,
  _opts: { adapter: WebhookAdapter },
): never => {
  throw new NotifyRpcNotImplementedError('toFetchHandler() (Layer 6)');
};
