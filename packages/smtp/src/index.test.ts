import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotifyRpcProviderError } from '@betternotify/core';

const sendMailMock = vi.fn();
const verifyMock = vi.fn();
const closeMock = vi.fn();
const createTransportMock = vi.fn(() => ({
  sendMail: sendMailMock,
  verify: verifyMock,
  close: closeMock,
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: createTransportMock },
}));

const { smtpTransport } = await import('./index.js');

const baseMessage = {
  from: 'from@example.com',
  to: ['to@example.com'],
  subject: 'Hello',
  html: '<p>hi</p>',
  text: 'hi',
  headers: {},
  attachments: [],
  inlineAssets: {},
};

const baseCtx = { route: 'welcome', messageId: 'm1', attempt: 1 };

beforeEach(() => {
  sendMailMock.mockReset();
  verifyMock.mockReset();
  closeMock.mockReset();
  createTransportMock.mockClear();
});

describe('smtpTransport', () => {
  it('forwards mapped fields to nodemailer.sendMail and returns TransportResult', async () => {
    sendMailMock.mockResolvedValue({
      messageId: '<abc@x>',
      accepted: ['to@example.com'],
      rejected: [],
    });
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    const result = await t.send(
      {
        ...baseMessage,
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        replyTo: 'reply@example.com',
      },
      baseCtx,
    );

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const arg = sendMailMock.mock.calls[0]?.[0];
    expect(arg.from).toBe('from@example.com');
    expect(arg.to).toEqual(['to@example.com']);
    expect(arg.cc).toEqual(['cc@example.com']);
    expect(arg.bcc).toEqual(['bcc@example.com']);
    expect(arg.replyTo).toBe('reply@example.com');
    expect(arg.subject).toBe('Hello');
    expect(arg.html).toBe('<p>hi</p>');
    expect(arg.text).toBe('hi');

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.transportMessageId).toBe('<abc@x>');
    expect(result.data.accepted).toEqual(['to@example.com']);
    expect(result.data.rejected).toEqual([]);
  });

  it('verify() returns { ok: true } when nodemailer resolves true', async () => {
    verifyMock.mockResolvedValue(true);
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    if (!t.verify) throw new Error('verify expected');
    const r = await t.verify();
    expect(r).toEqual({ ok: true });
  });

  it('close() calls transporter.close()', async () => {
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    if (!t.close) throw new Error('close expected');
    await t.close();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('formats Address objects in to[] preserving display name', async () => {
    sendMailMock.mockResolvedValue({
      messageId: 'x',
      accepted: [],
      rejected: [],
    });
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    await t.send(
      {
        ...baseMessage,
        to: [{ name: 'Alice', email: 'alice@example.com' }, { email: 'bob@example.com' }],
      },
      baseCtx,
    );
    const arg = sendMailMock.mock.calls[0]?.[0];
    expect(arg.to).toEqual(['"Alice" <alice@example.com>', 'bob@example.com']);
  });

  it('maps attachments through to nodemailer with filename/content/contentType/cid', async () => {
    sendMailMock.mockResolvedValue({
      messageId: 'x',
      accepted: [],
      rejected: [],
    });
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    await t.send(
      {
        ...baseMessage,
        attachments: [
          {
            filename: 'invoice.pdf',
            content: Buffer.from('pdf-bytes'),
            contentType: 'application/pdf',
          },
          {
            filename: 'logo.png',
            content: 'base64-data',
            contentType: 'image/png',
            cid: 'logo@inline',
          },
        ],
      },
      baseCtx,
    );
    const arg = sendMailMock.mock.calls[0]?.[0];
    expect(arg.attachments).toEqual([
      {
        filename: 'invoice.pdf',
        content: Buffer.from('pdf-bytes'),
        contentType: 'application/pdf',
        cid: undefined,
      },
      {
        filename: 'logo.png',
        content: 'base64-data',
        contentType: 'image/png',
        cid: 'logo@inline',
      },
    ]);
  });

  it('warns once per unique from-address when from differs from auth.user', async () => {
    sendMailMock.mockResolvedValue({
      messageId: 'x',
      accepted: [],
      rejected: [],
    });
    const records: Array<{ msg: string; payload?: object }> = [];
    const log = {
      debug: () => {},
      info: () => {},
      warn: (msg: string, payload?: object) => records.push({ msg, payload }),
      error: () => {},
      child: () => log,
    };
    const t = smtpTransport({
      host: 'smtp.x.com',
      port: 587,
      auth: { user: 'auth@x.com', pass: 'p' },
      logger: log,
    });
    await t.send({ ...baseMessage, from: 'other@x.com' }, baseCtx);
    await t.send({ ...baseMessage, from: 'other@x.com' }, baseCtx);
    await t.send({ ...baseMessage, from: 'auth@x.com' }, baseCtx);
    expect(records).toHaveLength(1);
    expect(records[0]?.msg).toContain('From address differs from SMTP auth user');
    expect(records[0]?.payload).toMatchObject({
      fromAddress: 'other@x.com',
      authUser: 'auth@x.com',
    });
  });

  it('falls back to auth.user when message.from is missing', async () => {
    sendMailMock.mockResolvedValue({ messageId: 'x', accepted: [], rejected: [] });
    const t = smtpTransport({
      host: 'smtp.x.com',
      port: 587,
      auth: { user: 'auth@x.com', pass: 'p' },
    });
    const msg = { ...baseMessage } as Record<string, unknown>;
    delete msg.from;
    await t.send(msg as never, baseCtx);
    expect(sendMailMock.mock.calls[0]?.[0].from).toBe('auth@x.com');
  });

  it('throws CONFIG when no from is resolvable from message or auth', async () => {
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    const msg = { ...baseMessage } as Record<string, unknown>;
    delete msg.from;
    await expect(t.send(msg as never, baseCtx)).rejects.toThrow(/no "from"/);
  });

  it('handles UTF-8 subject, display name, and body', async () => {
    sendMailMock.mockResolvedValue({ messageId: 'x', accepted: [], rejected: [] });
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    await t.send(
      {
        ...baseMessage,
        from: { name: 'José García', email: 'jose@example.com' },
        to: [{ name: 'Müller', email: 'muller@example.com' }],
        subject: 'Welcome — José! 📧',
        html: '<p>Héllo wörld 🌍</p>',
        text: 'Héllo wörld 🌍',
      },
      baseCtx,
    );
    const arg = sendMailMock.mock.calls[0]?.[0];
    expect(arg.from).toBe('"José García" <jose@example.com>');
    expect(arg.to).toEqual(['"Müller" <muller@example.com>']);
    expect(arg.subject).toBe('Welcome — José! 📧');
    expect(arg.html).toBe('<p>Héllo wörld 🌍</p>');
    expect(arg.text).toBe('Héllo wörld 🌍');
  });

  it('passes custom headers through to nodemailer', async () => {
    sendMailMock.mockResolvedValue({ messageId: 'x', accepted: [], rejected: [] });
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    const headers = { 'X-Custom-Id': 'abc-123', 'X-Campaign': 'onboarding' };
    await t.send({ ...baseMessage, headers }, baseCtx);
    const arg = sendMailMock.mock.calls[0]?.[0];
    expect(arg.headers).toEqual(headers);
  });

  it('verify() rejects when nodemailer rejects', async () => {
    verifyMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    if (!t.verify) throw new Error('verify expected');
    await expect(t.verify()).rejects.toThrow('ECONNREFUSED');
  });

  it('sends HTML-only when text is omitted', async () => {
    sendMailMock.mockResolvedValue({ messageId: 'x', accepted: [], rejected: [] });
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    const { text: _text, ...htmlOnly } = baseMessage;
    await t.send(htmlOnly as never, baseCtx);
    const arg = sendMailMock.mock.calls[0]?.[0];
    expect(arg.html).toBe('<p>hi</p>');
    expect(arg.text).toBeUndefined();
  });

  it('sends text-only when html is omitted', async () => {
    sendMailMock.mockResolvedValue({ messageId: 'x', accepted: [], rejected: [] });
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    const { html: _html, ...textOnly } = baseMessage;
    await t.send(textOnly as never, baseCtx);
    const arg = sendMailMock.mock.calls[0]?.[0];
    expect(arg.text).toBe('hi');
    expect(arg.html).toBeUndefined();
  });

  it('silently drops inlineAssets, tags, and priority (not mapped to nodemailer)', async () => {
    sendMailMock.mockResolvedValue({ messageId: 'x', accepted: [], rejected: [] });
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    await t.send(
      {
        ...baseMessage,
        inlineAssets: { logo: { content: Buffer.from('png'), contentType: 'image/png' } },
        tags: { campaign: 'onboarding' },
        priority: 'high',
      } as never,
      baseCtx,
    );
    const arg = sendMailMock.mock.calls[0]?.[0];
    expect(arg.inlineAssets).toBeUndefined();
    expect(arg.tags).toBeUndefined();
    expect(arg.priority).toBeUndefined();
  });
});

describe('smtpTransport — error normalization', () => {
  it('returns retriable NotifyRpcProviderError for SMTP 4xx temp failure', async () => {
    const err = new Error('Mailbox temporarily unavailable') as Error & {
      responseCode: number;
      code: string;
    };
    err.responseCode = 450;
    err.code = 'EENVELOPE';
    sendMailMock.mockRejectedValue(err);
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    const result = await t.send(baseMessage, baseCtx);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcProviderError);
    const providerErr = result.error as NotifyRpcProviderError;
    expect(providerErr.code).toBe('PROVIDER');
    expect(providerErr.provider).toBe('smtp');
    expect(providerErr.providerCode).toBe(450);
    expect(providerErr.retriable).toBe(true);
    expect(providerErr.cause).toBe(err);
  });

  it('returns terminal NotifyRpcProviderError for SMTP 5xx permanent failure', async () => {
    const err = new Error('Mailbox not found') as Error & {
      responseCode: number;
      code: string;
    };
    err.responseCode = 550;
    err.code = 'EENVELOPE';
    sendMailMock.mockRejectedValue(err);
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    const result = await t.send(baseMessage, baseCtx);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const providerErr = result.error as NotifyRpcProviderError;
    expect(providerErr.code).toBe('PROVIDER');
    expect(providerErr.provider).toBe('smtp');
    expect(providerErr.providerCode).toBe(550);
    expect(providerErr.retriable).toBe(false);
  });

  it('returns terminal CONFIG error for EAUTH', async () => {
    const err = new Error('Invalid login') as Error & { code: string };
    err.code = 'EAUTH';
    sendMailMock.mockRejectedValue(err);
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    const result = await t.send(baseMessage, baseCtx);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const providerErr = result.error as NotifyRpcProviderError;
    expect(providerErr.code).toBe('CONFIG');
    expect(providerErr.provider).toBe('smtp');
    expect(providerErr.retriable).toBe(false);
  });

  it('returns retriable PROVIDER error for ESOCKET', async () => {
    const err = new Error('Connection refused') as Error & { code: string };
    err.code = 'ESOCKET';
    sendMailMock.mockRejectedValue(err);
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    const result = await t.send(baseMessage, baseCtx);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const providerErr = result.error as NotifyRpcProviderError;
    expect(providerErr.code).toBe('PROVIDER');
    expect(providerErr.provider).toBe('smtp');
    expect(providerErr.retriable).toBe(true);
  });

  it('returns retriable PROVIDER error for ECONNECTION', async () => {
    const err = new Error('Connection timeout') as Error & { code: string };
    err.code = 'ECONNECTION';
    sendMailMock.mockRejectedValue(err);
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    const result = await t.send(baseMessage, baseCtx);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const providerErr = result.error as NotifyRpcProviderError;
    expect(providerErr.code).toBe('PROVIDER');
    expect(providerErr.provider).toBe('smtp');
    expect(providerErr.retriable).toBe(true);
  });

  it('returns retriable PROVIDER error for unknown errors', async () => {
    sendMailMock.mockRejectedValue(new Error('something unexpected'));
    const t = smtpTransport({ host: 'smtp.x.com', port: 587 });
    const result = await t.send(baseMessage, baseCtx);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const providerErr = result.error as NotifyRpcProviderError;
    expect(providerErr.code).toBe('PROVIDER');
    expect(providerErr.provider).toBe('smtp');
    expect(providerErr.retriable).toBe(true);
  });
});
