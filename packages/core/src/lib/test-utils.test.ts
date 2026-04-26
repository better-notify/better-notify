import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTestSender, memoryLogger, recordHooks } from './test-utils.js';
import { mockTransport } from '../lib/mock-transport.js';
import { createEmailRpc } from '../factory.js';
import { EmailRpcNotImplementedError } from '../errors.js';
import type { TemplateAdapter } from '../template.js';

describe('test utility stubs', () => {
  it('createTestSender() throws EmailRpcNotImplementedError', () => {
    const adapter: TemplateAdapter<{ name: string }> = {
      render: async () => ({ html: '' }),
    };
    const t = createEmailRpc();
    const router = t.catalog({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template(adapter),
    });
    expect(() => createTestSender({ router, transport: mockTransport() })).toThrow(
      EmailRpcNotImplementedError,
    );
  });

  it('recordHooks() throws EmailRpcNotImplementedError', () => {
    expect(() => recordHooks()).toThrow(EmailRpcNotImplementedError);
  });
});

describe('memoryLogger', () => {
  it('records calls with merged bindings', () => {
    const log = memoryLogger();
    const child = log.child({ route: 'welcome' });
    child.info('start', { messageId: 'm1' });
    child.error('boom', { err: new Error('x') });
    expect(log.records).toHaveLength(2);
    expect(log.records[0]).toMatchObject({
      level: 'info',
      message: 'start',
      bindings: { route: 'welcome' },
      payload: { messageId: 'm1' },
    });
    const second = log.records[1];
    if (!second) throw new Error('expected second record');
    expect(second.payload).toMatchObject({ err: expect.any(Error) });
  });

  it('shares records across child generations and clear() resets', () => {
    const log = memoryLogger();
    log.child({ a: 1 }).child({ b: 2 }).warn('w');
    expect(log.records).toHaveLength(1);
    const first = log.records[0];
    if (!first) throw new Error('expected record');
    expect(first.bindings).toEqual({ a: 1, b: 2 });
    log.clear();
    expect(log.records).toHaveLength(0);
  });
});
