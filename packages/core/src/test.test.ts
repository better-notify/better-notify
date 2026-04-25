import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTestSender, memoryLogger, mockProvider, recordHooks } from './test.js';
import { emailRpc } from './init.js';
import { EmailRpcNotImplementedError } from './errors.js';
import type { TemplateAdapter } from './template.js';

describe('mockProvider', () => {
  it('records sent messages', async () => {
    const provider = mockProvider();
    expect(provider.sent).toHaveLength(0);

    const result = await provider.send(
      {
        from: 'hello@example.com',
        to: ['lucas@x.com'],
        subject: 'Test',
        html: '<p>hi</p>',
        text: 'hi',
        headers: {},
        attachments: [],
        inlineAssets: {},
      },
      { route: 'welcome', messageId: 'test-id', attempt: 1 },
    );

    expect(result.accepted).toEqual(['lucas@x.com']);
    expect(result.rejected).toEqual([]);
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]).toMatchObject({
      route: 'welcome',
      to: ['lucas@x.com'],
      subject: 'Test',
      html: '<p>hi</p>',
      text: 'hi',
    });
  });

  it('resets recorded messages', async () => {
    const provider = mockProvider();
    await provider.send(
      {
        from: 'a@b.com',
        to: ['c@d.com'],
        subject: 'x',
        html: '',
        text: '',
        headers: {},
        attachments: [],
        inlineAssets: {},
      },
      { route: 'test', messageId: 'id', attempt: 1 },
    );
    expect(provider.sent).toHaveLength(1);
    provider.reset();
    expect(provider.sent).toHaveLength(0);
  });

  it('normalizes Address objects to strings', async () => {
    const provider = mockProvider();
    await provider.send(
      {
        from: { name: 'Hello', address: 'hello@example.com' },
        to: [{ name: 'Lucas', address: 'lucas@x.com' }],
        subject: 'Test',
        html: '<p>hi</p>',
        text: 'hi',
        headers: {},
        attachments: [],
        inlineAssets: {},
      },
      { route: 'welcome', messageId: 'test-id', attempt: 1 },
    );
    expect(provider.sent[0]!.to).toEqual(['lucas@x.com']);
  });
});

describe('test utility stubs', () => {
  it('createTestSender() throws EmailRpcNotImplementedError', () => {
    const adapter: TemplateAdapter<{ name: string }> = {
      render: async () => ({ html: '' }),
    };
    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template(adapter),
    });
    expect(() => createTestSender({ router, provider: mockProvider() })).toThrow(
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
    expect(log.records[1]!.payload).toMatchObject({ err: expect.any(Error) });
  });

  it('shares records across child generations and clear() resets', () => {
    const log = memoryLogger();
    log.child({ a: 1 }).child({ b: 2 }).warn('w');
    expect(log.records).toHaveLength(1);
    expect(log.records[0]!.bindings).toEqual({ a: 1, b: 2 });
    log.clear();
    expect(log.records).toHaveLength(0);
  });
});
