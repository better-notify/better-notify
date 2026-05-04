import { describe, expect, it, vi, afterEach, beforeEach, type Mock } from 'vitest';
import { NotifyRpcError } from '@betternotify/core';
import type { RenderedSms } from '@betternotify/sms';
import type { SendContext } from '@betternotify/core';

let fetchMock: Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const ACCOUNT_SID = 'ACtest00000000000000000000000000';
const AUTH_TOKEN = 'test-auth-token-1234';
const FROM_NUMBER = '+15551234567';
const MESSAGING_SERVICE_SID = 'MG1234567890abcdef1234567890abcdef';

const baseMessage: RenderedSms = {
  body: 'Hello from BetterNotify!',
  to: '+15559876543',
};

const ctx: SendContext = { route: 'alerts.sms', messageId: 'msg-1', attempt: 1 };

const twilioSuccess = (sid = 'SM1234567890') =>
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ sid, status: 'queued', date_created: '2026-05-04T00:00:00Z' }), {
      status: 201,
    }),
  );

const twilioError = (httpStatus: number, code: number, message: string) =>
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ code, message, status: httpStatus }), { status: httpStatus }),
  );

describe('twilioSmsTransport', () => {
  it('throws CONFIG when neither fromNumber nor messagingServiceSid is provided', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    expect(() => twilioSmsTransport({ accountSid: ACCOUNT_SID, authToken: AUTH_TOKEN })).toThrow(
      NotifyRpcError,
    );
  });

  it('has name "twilio-sms"', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    expect(t.name).toBe('twilio-sms');
  });
});

describe('twilioSmsTransport — send', () => {
  it('POSTs form-encoded body with Basic Auth', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    twilioSuccess();
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    await t.send(baseMessage, ctx);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain(`/Accounts/${ACCOUNT_SID}/Messages.json`);
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers as Record<string, string>).get('Authorization')).toMatch(
      /^Basic /,
    );
    expect(new Headers(init.headers as Record<string, string>).get('Content-Type')).toBe(
      'application/x-www-form-urlencoded',
    );

    const params = new URLSearchParams(init.body);
    expect(params.get('To')).toBe('+15559876543');
    expect(params.get('From')).toBe(FROM_NUMBER);
    expect(params.get('Body')).toBe('Hello from BetterNotify!');
  });

  it('encodes accountSid:authToken as Basic Auth', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    twilioSuccess();
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    await t.send(baseMessage, ctx);

    const [, init] = fetchMock.mock.calls[0]!;
    const expected = btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);
    expect(new Headers(init.headers as Record<string, string>).get('Authorization')).toBe(
      `Basic ${expected}`,
    );
  });

  it('returns SmsTransportData with sid and provider on success', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    twilioSuccess('SM999');
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.messageId).toBe('SM999');
    expect(result.data.provider).toBe('twilio');
  });

  it('uses MessagingServiceSid instead of From when provided', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    twilioSuccess();
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      messagingServiceSid: MESSAGING_SERVICE_SID,
    });
    await t.send(baseMessage, ctx);

    const params = new URLSearchParams(fetchMock.mock.calls[0]![1].body);
    expect(params.get('MessagingServiceSid')).toBe(MESSAGING_SERVICE_SID);
    expect(params.has('From')).toBe(false);
  });

  it('prefers messagingServiceSid over fromNumber when both provided', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    twilioSuccess();
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
      messagingServiceSid: MESSAGING_SERVICE_SID,
    });
    await t.send(baseMessage, ctx);

    const params = new URLSearchParams(fetchMock.mock.calls[0]![1].body);
    expect(params.get('MessagingServiceSid')).toBe(MESSAGING_SERVICE_SID);
    expect(params.has('From')).toBe(false);
  });

  it('returns VALIDATION when "to" is missing', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.send({ body: 'hi' }, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('VALIDATION');
  });

  it('uses default timeout when http options are empty', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    twilioSuccess();
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
      http: {},
    });
    const result = await t.send(baseMessage, ctx);
    expect(result.ok).toBe(true);
  });

  it('uses custom baseUrl when provided', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    twilioSuccess();
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
      baseUrl: 'https://mock-twilio.test',
    });
    await t.send(baseMessage, ctx);

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/^https:\/\/mock-twilio\.test/);
  });
});

describe('twilioSmsTransport — error mapping', () => {
  it('maps Twilio 21211 (invalid To number) to VALIDATION', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    twilioError(400, 21211, "The 'To' number is not a valid phone number.");
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('VALIDATION');
  });

  it('maps Twilio 21610 (unsubscribed) to VALIDATION', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    twilioError(400, 21610, 'Attempt to send to unsubscribed recipient');
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('VALIDATION');
  });

  it('maps Twilio 20003 (auth failure) to CONFIG', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    twilioError(401, 20003, 'Authentication Error');
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('CONFIG');
  });

  it('maps HTTP 401 without Twilio code to CONFIG', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }),
    );
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('CONFIG');
  });

  it('maps 500 server error to PROVIDER', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    twilioError(500, 0, 'Internal Server Error');
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
  });

  it('maps Twilio 14107 (rate limit) to RATE_LIMITED', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    twilioError(429, 14107, 'Rate limit exceeded');
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('RATE_LIMITED');
  });

  it('maps HTTP 429 without Twilio code to RATE_LIMITED', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Too many requests' }), { status: 429 }),
    );
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('RATE_LIMITED');
  });

  it('maps HTTP 400 without recognized Twilio code to VALIDATION', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    twilioError(400, 99999, 'Some unknown validation error');
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('VALIDATION');
  });

  it('falls back to HTTP status in error message when Twilio message is missing', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 0 }), { status: 502 }));
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error.message).toContain('HTTP 502');
  });

  it('falls back to empty error data when response body is null', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    fetchMock.mockResolvedValue(new Response('', { status: 500, statusText: 'Internal Server Error' }));
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.send(baseMessage, ctx);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcError);
    expect((result.error as NotifyRpcError).message).toContain('HTTP 500');
  });

  it('includes Twilio error message in NotifyRpcError message', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    twilioError(400, 21211, "The 'To' number is not a valid phone number.");
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error.message).toContain("The 'To' number is not a valid phone number.");
  });
});

describe('twilioSmsTransport — network errors', () => {
  it('returns TIMEOUT when fetch throws TimeoutError', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    fetchMock.mockRejectedValue(new DOMException('aborted', 'AbortError'));
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('TIMEOUT');
    expect(result.error.message).toContain('request timed out');
  });

  it('returns PROVIDER when fetch throws network error', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
    expect(result.error.message).toContain('network error');
  });

  it('returns PROVIDER when response body is not valid JSON', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.send(baseMessage, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
  });
});

describe('twilioSmsTransport — verify', () => {
  it('returns ok: true with account details on success', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ friendly_name: 'Test Account', status: 'active' }), {
        status: 200,
      }),
    );
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.verify!();

    expect(result.ok).toBe(true);
    expect(result.details).toEqual({ friendlyName: 'Test Account', status: 'active' });
  });

  it('calls the correct account URL', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ friendly_name: 'Test', status: 'active' }), { status: 200 }),
    );
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    await t.verify!();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain(`/Accounts/${ACCOUNT_SID}.json`);
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers as Record<string, string>).get('Authorization')).toMatch(
      /^Basic /,
    );
  });

  it('returns ok: false when account fetch fails', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }),
    );
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.verify!();

    expect(result.ok).toBe(false);
  });

  it('returns ok: false when verify response is not valid JSON', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.verify!();

    expect(result.ok).toBe(false);
    expect(typeof result.details).toBe('string');
  });

  it('returns ok: false when fetch throws', async () => {
    const { twilioSmsTransport } = await import('./twilio.js');
    fetchMock.mockRejectedValue(new TypeError('network error'));
    const t = twilioSmsTransport({
      accountSid: ACCOUNT_SID,
      authToken: AUTH_TOKEN,
      fromNumber: FROM_NUMBER,
    });
    const result = await t.verify!();

    expect(result.ok).toBe(false);
    expect(result.details).toBe('network error');
  });
});
