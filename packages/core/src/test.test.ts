import { describe, expect, it } from 'vitest';
import { mockProvider } from './test.js';

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
