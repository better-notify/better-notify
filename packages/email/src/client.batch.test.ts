import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createClient, createNotify, EmailRpcError } from '@emailrpc/core';
import { emailChannel, mockTransport } from './index.js';
import type { TemplateAdapter } from './template.js';

const adapter: TemplateAdapter<{ name: string }> = {
  render: async ({ input }) => ({
    html: `<p>Hello ${input.name}</p>`,
    text: `Hello ${input.name}`,
  }),
};

const buildClient = () => {
  const ch = emailChannel();
  const rpc = createNotify({ channels: { email: ch } });
  const catalog = rpc.catalog({
    welcome: rpc
      .email()
      .input(z.object({ name: z.string() }))
      .from('hello@x.com')
      .subject(({ input }) => `Welcome, ${input.name}!`)
      .template(adapter),
  });
  const transport = mockTransport();
  const mail = createClient({
    catalog,
    channels: { email: ch },
    transportsByChannel: { email: transport },
  });
  return { mail, transport };
};

describe('client.batch', () => {
  it('sends a single ok entry', async () => {
    const { mail, transport } = buildClient();

    const result = await mail.welcome.batch([{ to: 'a@x.com', input: { name: 'Alice' } }]);

    expect(result.okCount).toBe(1);
    expect(result.errorCount).toBe(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ status: 'ok', index: 0 });
    expect(transport.sent).toHaveLength(1);
  });

  it('sends three ok entries in input order', async () => {
    const { mail, transport } = buildClient();

    const result = await mail.welcome.batch([
      { to: 'a@x.com', input: { name: 'Alice' } },
      { to: 'b@x.com', input: { name: 'Bob' } },
      { to: 'c@x.com', input: { name: 'Carol' } },
    ]);

    expect(result.okCount).toBe(3);
    expect(result.errorCount).toBe(0);
    expect(result.results.map((r) => r.index)).toEqual([0, 1, 2]);
    expect(transport.sent.map((s) => s.to[0])).toEqual(['a@x.com', 'b@x.com', 'c@x.com']);
  });

  it('captures validation errors per-entry without aborting', async () => {
    const { mail, transport } = buildClient();

    const result = await mail.welcome.batch([
      { to: 'a@x.com', input: { name: 'Alice' } },
      { to: 'b@x.com', input: { name: 123 as unknown as string } },
      { to: 'c@x.com', input: { name: 'Carol' } },
    ]);

    expect(result.okCount).toBe(2);
    expect(result.errorCount).toBe(1);
    const failed = result.results[1];
    if (!failed || failed.status !== 'error') throw new Error('expected error entry at index 1');
    expect(failed.error).toBeInstanceOf(EmailRpcError);
    expect(failed.error.code).toBe('VALIDATION');
    expect(transport.sent).toHaveLength(2);
  });

  it('captures transport errors per-entry without aborting', async () => {
    const ch = emailChannel();
    const rpc = createNotify({ channels: { email: ch } });
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .input(z.object({ name: z.string() }))
        .from('hello@x.com')
        .subject(({ input }) => `Welcome, ${input.name}!`)
        .template(adapter),
    });
    let calls = 0;
    const flakyTransport = {
      name: 'flaky',
      send: async () => {
        calls++;
        if (calls === 2) throw new Error('boom');
        return { accepted: ['x'], rejected: [] };
      },
    };
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: flakyTransport },
    });

    const result = await mail.welcome.batch([
      { to: 'a@x.com', input: { name: 'Alice' } },
      { to: 'b@x.com', input: { name: 'Bob' } },
      { to: 'c@x.com', input: { name: 'Carol' } },
    ]);

    expect(result.okCount).toBe(2);
    expect(result.errorCount).toBe(1);
    const failed = result.results[1];
    if (!failed || failed.status !== 'error') throw new Error('expected error entry at index 1');
    expect(failed.error.code).toBe('PROVIDER');
  });

  it('respects interval between sends', async () => {
    const { mail } = buildClient();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    await mail.welcome.batch(
      [
        { to: 'a@x.com', input: { name: 'Alice' } },
        { to: 'b@x.com', input: { name: 'Bob' } },
        { to: 'c@x.com', input: { name: 'Carol' } },
      ],
      { interval: 50 },
    );

    const intervalCalls = setTimeoutSpy.mock.calls.filter(([, ms]) => ms === 50);
    expect(intervalCalls).toHaveLength(2);
    setTimeoutSpy.mockRestore();
  });

  it('does not wait when interval is 0 or undefined', async () => {
    const { mail } = buildClient();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    await mail.welcome.batch([
      { to: 'a@x.com', input: { name: 'Alice' } },
      { to: 'b@x.com', input: { name: 'Bob' } },
    ]);

    const intervalCalls = setTimeoutSpy.mock.calls.filter(([, ms]) => typeof ms === 'number' && ms > 0);
    expect(intervalCalls).toHaveLength(0);
    setTimeoutSpy.mockRestore();
  });

  it('fires hooks per entry with unique messageIds', async () => {
    const ch = emailChannel();
    const rpc = createNotify({ channels: { email: ch } });
    const beforeSent: string[] = [];
    const afterSent: string[] = [];
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .input(z.object({ name: z.string() }))
        .from('hello@x.com')
        .subject(({ input }) => `Welcome, ${input.name}!`)
        .template(adapter),
    });
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: mockTransport() },
      hooks: {
        onBeforeSend: ({ messageId }) => {
          beforeSent.push(messageId);
        },
        onAfterSend: ({ messageId }) => {
          afterSent.push(messageId);
        },
      },
    });

    await mail.welcome.batch([
      { to: 'a@x.com', input: { name: 'Alice' } },
      { to: 'b@x.com', input: { name: 'Bob' } },
      { to: 'c@x.com', input: { name: 'Carol' } },
    ]);

    expect(beforeSent).toHaveLength(3);
    expect(afterSent).toHaveLength(3);
    expect(new Set(afterSent).size).toBe(3);
    expect(beforeSent).toEqual(afterSent);
  });

  it('flows per-entry override fields into the rendered message', async () => {
    const { mail, transport } = buildClient();

    await mail.welcome.batch([
      {
        to: 'a@x.com',
        cc: 'cc@x.com',
        bcc: ['bcc@x.com'],
        replyTo: 'reply@x.com',
        headers: { 'X-Vip': 'yes' },
        attachments: [
          { filename: 'a.txt', content: Buffer.from('hi'), contentType: 'text/plain' },
        ],
        input: { name: 'Alice' },
      },
    ]);

    const sent = transport.sent[0];
    expect(sent).toBeDefined();
    expect(sent?.cc).toEqual(['cc@x.com']);
    expect(sent?.bcc).toEqual(['bcc@x.com']);
    expect(sent?.replyTo).toBe('reply@x.com');
    expect(sent?.headers['X-Vip']).toBe('yes');
    expect(sent?.attachments).toBe(1);
  });

  it('wraps non-EmailRpcError throws from hooks as UNKNOWN', async () => {
    const ch = emailChannel();
    const rpc = createNotify({ channels: { email: ch } });
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .input(z.object({ name: z.string() }))
        .from('hello@x.com')
        .subject(({ input }) => `Welcome, ${input.name}!`)
        .template(adapter),
    });
    let calls = 0;
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: mockTransport() },
      hooks: {
        onBeforeSend: () => {
          calls++;
          if (calls === 2) throw new Error('plain hook failure');
        },
      },
    });

    const result = await mail.welcome.batch([
      { to: 'a@x.com', input: { name: 'Alice' } },
      { to: 'b@x.com', input: { name: 'Bob' } },
      { to: 'c@x.com', input: { name: 'Carol' } },
    ]);

    expect(result.okCount).toBe(2);
    expect(result.errorCount).toBe(1);
    const failed = result.results[1];
    if (!failed || failed.status !== 'error') throw new Error('expected error entry at index 1');
    expect(failed.error).toBeInstanceOf(EmailRpcError);
    expect(failed.error.code).toBe('UNKNOWN');
    expect(failed.error.message).toBe('plain hook failure');
    expect(failed.error.cause).toBeInstanceOf(Error);
    expect(failed.error.route).toBe('welcome');
  });

  it('rejects an empty array', async () => {
    const { mail } = buildClient();
    await expect(mail.welcome.batch([])).rejects.toThrow(EmailRpcError);
    const [err] = await mail.welcome
      .batch([])
      .then(() => [null])
      .catch((e: unknown) => [e]);
    expect((err as EmailRpcError).code).toBe('BATCH_EMPTY');
  });
});
