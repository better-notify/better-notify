import { handlePromise } from '../lib/handle-promise.js';
import type { Middleware } from './types.js';
import type { WithTracingOptions } from './with-tracing.types.js';

/**
 * Wrap each send in a tracing span using the supplied `TracerLike`.
 *
 * The tracer interface is structurally compatible with
 * `@opentelemetry/api`'s `Tracer.startActiveSpan(name, fn)`, so an OTel
 * tracer can be passed directly with no adapter:
 *
 * ```ts
 * import { trace } from '@opentelemetry/api';
 * t.use(withTracing({ tracer: trace.getTracer('emailrpc') }))
 * ```
 *
 * For tests use `inMemoryTracer()` to record spans for assertion. The default
 * span name is `emailrpc.send.<route>`; supply `name` (string or function) to
 * override.
 *
 * Span attributes set on every send: `emailrpc.route`, `emailrpc.message_id`.
 * On failure the exception is recorded and status set to `error`; on success
 * status is set to `ok`.
 */
export const withTracing = (opts: WithTracingOptions): Middleware => {
  const resolveName = (route: string, messageId: string): string => {
    if (typeof opts.name === 'function') return opts.name({ route, messageId });
    if (typeof opts.name === 'string') return opts.name;
    return `emailrpc.send.${route}`;
  };

  return async ({ route, messageId, next }) => {
    return opts.tracer.startActiveSpan(resolveName(route, messageId), async (span) => {
      span.setAttribute('emailrpc.route', route);
      span.setAttribute('emailrpc.message_id', messageId);
      const [err, result] = await handlePromise(next());
      if (err) {
        span.recordException(err);
        span.setStatus({ code: 'error', message: err.message });
        span.end();
        throw err;
      }
      span.setStatus({ code: 'ok' });
      span.end();
      return result;
    });
  };
};
