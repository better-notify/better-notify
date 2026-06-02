import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runSendPipeline, normalizeHooks, type SendPipelineDeps } from './pipeline.js';
import { consoleLogger } from './logger.js';
import { NotifyRpcError } from './errors.js';
import { handlePromise } from './lib/handle-promise.js';
import type { AnyChannel, ChannelDefinition } from './channel/types.js';
import type { Transport } from './transport.js';

const schema = z.object({ name: z.string() });
const def: ChannelDefinition<any, any> = {
  id: 'ping',
  channel: 'test',
  schema,
  middleware: [],
  runtime: {},
  _args: undefined as never,
  _rendered: undefined as never,
};
const channel = {
  name: 'test',
  createBuilder: () => ({}),
  finalize: (s: unknown) => s,
  validateArgs: (a: unknown) => a,
  render: async (_d: unknown, args: { input: { name: string } }) => ({
    body: `hi ${args.input.name}`,
  }),
  _transport: undefined as never,
} as unknown as AnyChannel;

const okTransport = (): Transport => ({
  name: 'ok',
  send: async () => ({ ok: true, data: { id: 'x' } }),
});

const deps = (transport: Transport): SendPipelineDeps => ({
  channels: { test: channel },
  transportsByChannel: { test: transport },
  hooks: normalizeHooks([]),
  pluginMiddleware: [],
  logger: consoleLogger({ level: 'error' }).child({ component: 'test' }),
});

describe('runSendPipeline', () => {
  it('renders and sends, returning a result with messageId', async () => {
    const r = await runSendPipeline(
      deps(okTransport()),
      def,
      { input: { name: 'Ada' } },
      'ping',
      {},
    );
    expect(r.messageId).toBeTruthy();
    expect(r.data).toEqual({ id: 'x' });
  });

  it('throws a VALIDATION NotifyRpcError on bad input', async () => {
    const [err] = await handlePromise(
      runSendPipeline(deps(okTransport()), def, { input: { name: 42 } }, 'ping', {}),
    );
    expect(err).toBeInstanceOf(NotifyRpcError);
    expect((err as NotifyRpcError).code).toBe('VALIDATION');
  });

  it('defaults ctx to {} when undefined is passed', async () => {
    const r = await runSendPipeline(
      deps(okTransport()),
      def,
      { input: { name: 'Ada' } },
      'ping',
      undefined,
    );
    expect(r.messageId).toBeTruthy();
  });

  it('passes the supplied attempt through to the transport', async () => {
    const seen: number[] = [];
    const recording: Transport = {
      name: 'rec',
      send: async (_rendered, ctx) => {
        seen.push(ctx.attempt);
        return { ok: true, data: { id: 'x' } };
      },
    };
    await runSendPipeline(deps(recording), def, { input: { name: 'Ada' } }, 'ping', {}, 4);
    expect(seen).toEqual([4]);
  });

  const withHooks = (
    transport: Transport,
    hooks: Parameters<typeof normalizeHooks>[0][number],
  ) => ({
    ...deps(transport),
    hooks: normalizeHooks([hooks]),
  });

  it('rethrows a NotifyRpcError from onBeforeSend unchanged', async () => {
    const boom = new NotifyRpcError({ message: 'before boom', code: 'CONFIG' });
    const [err] = await handlePromise(
      runSendPipeline(
        withHooks(okTransport(), {
          onBeforeSend: () => {
            throw boom;
          },
        }),
        def,
        { input: { name: 'Ada' } },
        'ping',
        {},
      ),
    );
    expect(err).toBe(boom);
  });

  it('wraps a plain Error from onBeforeSend as an UNKNOWN NotifyRpcError', async () => {
    const [err] = await handlePromise(
      runSendPipeline(
        withHooks(okTransport(), {
          onBeforeSend: () => {
            throw new Error('plain before');
          },
        }),
        def,
        { input: { name: 'Ada' } },
        'ping',
        {},
      ),
    );
    expect(err).toBeInstanceOf(NotifyRpcError);
    expect((err as NotifyRpcError).code).toBe('UNKNOWN');
  });

  it('rethrows a NotifyRpcError from onExecute unchanged', async () => {
    const boom = new NotifyRpcError({ message: 'exec boom', code: 'CONFIG' });
    const [err] = await handlePromise(
      runSendPipeline(
        withHooks(okTransport(), {
          onExecute: () => {
            throw boom;
          },
        }),
        def,
        { input: { name: 'Ada' } },
        'ping',
        {},
      ),
    );
    expect(err).toBe(boom);
  });

  it('wraps a plain Error from onExecute as an UNKNOWN NotifyRpcError', async () => {
    const [err] = await handlePromise(
      runSendPipeline(
        withHooks(okTransport(), {
          onExecute: () => {
            throw new Error('plain exec');
          },
        }),
        def,
        { input: { name: 'Ada' } },
        'ping',
        {},
      ),
    );
    expect(err).toBeInstanceOf(NotifyRpcError);
    expect((err as NotifyRpcError).code).toBe('UNKNOWN');
  });
});
