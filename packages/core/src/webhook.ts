import { EmailRpcNotImplementedError } from './errors.js';
import type { AnyStandardSchema, InferOutput } from './schema.js';

export interface WebhookHandler<TSchema extends AnyStandardSchema, TCtx> {
  (params: { input: InferOutput<TSchema>; ctx: TCtx }): Promise<void> | void;
}

export interface WebhookDefinition<TSchema extends AnyStandardSchema, TCtx> {
  schema: TSchema;
  handler: WebhookHandler<TSchema, TCtx>;
}

export interface WebhookRouter {
  readonly _brand: 'WebhookRouter';
  readonly handlers: Record<string, WebhookDefinition<AnyStandardSchema, unknown>>;
}

export interface WebhookAdapter {
  name: string;
  parse(
    payload: unknown,
    headers: Record<string, string>,
  ): Promise<{ event: string; data: unknown }>;
  verify?(payload: unknown, headers: Record<string, string>): Promise<boolean>;
}

export function toNodeHandler(_router: WebhookRouter, _opts: { adapter: WebhookAdapter }): never {
  throw new EmailRpcNotImplementedError('toNodeHandler() (Layer 6)');
}

export function toFetchHandler(_router: WebhookRouter, _opts: { adapter: WebhookAdapter }): never {
  throw new EmailRpcNotImplementedError('toFetchHandler() (Layer 6)');
}
