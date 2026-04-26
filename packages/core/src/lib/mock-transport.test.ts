import { describe, expect, it } from 'vitest';
import { mockTransport } from './mock-transport.js';

describe('mockTransport', () => {
  it('records sent messages', async () => {
    const transport = mockTransport();
    expect(transport.sent).toHaveLength(0);

    const result = await transport.send(
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
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]).toMatchObject({
      route: 'welcome',
      to: ['lucas@x.com'],
      subject: 'Test',
      html: '<p>hi</p>',
      text: 'hi',
    });
  });

  it('resets recorded messages', async () => {
    const transport = mockTransport();
    await transport.send(
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
    expect(transport.sent).toHaveLength(1);
    transport.reset();
    expect(transport.sent).toHaveLength(0);
  });

  it('normalizes Address objects to strings', async () => {
    const transport = mockTransport();
    await transport.send(
      {
        from: { name: 'Hello', email: 'hello@example.com' },
        to: [{ name: 'Lucas', email: 'lucas@x.com' }],
        subject: 'Test',
        html: '<p>hi</p>',
        text: 'hi',
        headers: {},
        attachments: [],
        inlineAssets: {},
      },
      { route: 'welcome', messageId: 'test-id', attempt: 1 },
    );
    const first = transport.sent[0];
    if (!first) throw new Error('expected record');
    expect(first.to).toEqual(['lucas@x.com']);
  });
});
