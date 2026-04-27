import { describe, expect, it, vi, beforeEach } from 'vitest';

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
});
