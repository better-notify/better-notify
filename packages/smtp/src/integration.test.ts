import { describe, expect, it } from 'vitest';
import nodemailer from 'nodemailer';
import { smtpTransport } from './index.js';

describe.skipIf(process.env.SMTP_INTEGRATION !== '1')('integration (Ethereal)', () => {
  it('sends a real email through Ethereal SMTP', async () => {
    const account = await nodemailer.createTestAccount();
    const t = smtpTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass },
    });

    try {
      const result = await t.send(
        {
          from: account.user,
          to: ['recipient@example.com'],
          subject: 'BetterNotify SMTP integration test — José 📧',
          html: '<h1>Hello, Wörld! 🌍</h1><p>This is a test from <code>@betternotify/smtp</code>.</p>',
          text: 'Hello, Wörld! 🌍\n\nThis is a test from @betternotify/smtp.',
          headers: { 'X-BetterNotify-Test': 'true' },
          attachments: [
            {
              filename: 'hello.txt',
              content: Buffer.from('Hello from BetterNotify!'),
              contentType: 'text/plain',
            },
          ],
        },
        { route: 'integration-test', messageId: 'int-1', attempt: 1 },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.transportMessageId).toBeDefined();
      expect(result.data.accepted).toContain('recipient@example.com');

      const previewUrl = nodemailer.getTestMessageUrl(
        result.data.raw as Parameters<typeof nodemailer.getTestMessageUrl>[0],
      );
      if (previewUrl) {
        console.log('Ethereal preview:', previewUrl);
      }
    } finally {
      if (t.close) await t.close();
    }
  });

  it('verify() succeeds against Ethereal', async () => {
    const account = await nodemailer.createTestAccount();
    const t = smtpTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass },
    });

    try {
      if (!t.verify) throw new Error('verify expected');
      const r = await t.verify();
      expect(r).toEqual({ ok: true });
    } finally {
      if (t.close) await t.close();
    }
  });
});
