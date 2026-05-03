import { describe, expect, it, vi, afterEach } from 'vitest';
import { slackTransport } from './slack.js';
import { mockSlackTransport } from './mock.js';

const mockFetch = (response: { ok: boolean; error?: string; ts?: string; channel?: string }) =>
  vi.fn().mockResolvedValue({
    ok: true,
    json: async () => response,
  });

const ctx = { route: 'test.route', messageId: 'msg-1', attempt: 1 };

describe('slackTransport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends text message via chat.postMessage', async () => {
    const fetchMock = mockFetch({ ok: true, ts: '1234.5678', channel: 'C123' });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    const result = await t.send({ text: 'Hello!', to: '#general' }, ctx);

    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe('https://slack.com/api/chat.postMessage');
    expect(call[1].headers).toMatchObject({
      Authorization: 'Bearer xoxb-test',
      'Content-Type': 'application/json',
    });
    const body = JSON.parse(call[1].body as string);
    expect(body).toEqual({ channel: '#general', text: 'Hello!' });
    expect(result).toEqual({ ok: true, data: { ts: '1234.5678', channel: 'C123' } });
  });

  it('includes blocks when provided', async () => {
    const fetchMock = mockFetch({ ok: true, ts: '1.2', channel: 'C1' });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    const blocks = [
      { type: 'section' as const, text: { type: 'mrkdwn' as const, text: '*bold*' } },
    ];
    await t.send({ text: 'fallback', to: '#alerts', blocks }, ctx);

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body.blocks).toEqual(blocks);
    expect(body.text).toBe('fallback');
  });

  it('includes thread_ts when threadTs is set', async () => {
    const fetchMock = mockFetch({ ok: true, ts: '1.3', channel: 'C1' });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    await t.send({ text: 'reply', to: '#general', threadTs: '1111.2222' }, ctx);

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body.thread_ts).toBe('1111.2222');
  });

  it('uses defaultChannel when rendered.to is not set', async () => {
    const fetchMock = mockFetch({ ok: true, ts: '1.4', channel: 'C999' });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test', defaultChannel: '#fallback' });
    await t.send({ text: 'hi' }, ctx);

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body.channel).toBe('#fallback');
  });

  it('returns VALIDATION error when no channel is resolved', async () => {
    const t = slackTransport({ token: 'xoxb-test' });
    const result = await t.send({ text: 'hi' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('channel');
      expect((result.error as any).code).toBe('VALIDATION');
    }
  });

  it('returns CONFIG error for invalid_auth', async () => {
    const fetchMock = mockFetch({ ok: false, error: 'invalid_auth' });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-bad' });
    const result = await t.send({ text: 'hi', to: '#x' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('invalid_auth');
      expect((result.error as any).code).toBe('CONFIG');
    }
  });

  it('returns CONFIG error for token_revoked', async () => {
    const fetchMock = mockFetch({ ok: false, error: 'token_revoked' });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-bad' });
    const result = await t.send({ text: 'hi', to: '#x' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as any).code).toBe('CONFIG');
  });

  it('returns CONFIG error for not_authed', async () => {
    const fetchMock = mockFetch({ ok: false, error: 'not_authed' });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-bad' });
    const result = await t.send({ text: 'hi', to: '#x' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as any).code).toBe('CONFIG');
  });

  it('returns CONFIG error for account_inactive', async () => {
    const fetchMock = mockFetch({ ok: false, error: 'account_inactive' });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-bad' });
    const result = await t.send({ text: 'hi', to: '#x' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as any).code).toBe('CONFIG');
  });

  it('returns VALIDATION error for channel_not_found', async () => {
    const fetchMock = mockFetch({ ok: false, error: 'channel_not_found' });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    const result = await t.send({ text: 'hi', to: '#bad' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('channel_not_found');
      expect((result.error as any).code).toBe('VALIDATION');
    }
  });

  it('returns VALIDATION error for no_text', async () => {
    const fetchMock = mockFetch({ ok: false, error: 'no_text' });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    const result = await t.send({ text: '', to: '#x' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as any).code).toBe('VALIDATION');
  });

  it('returns PROVIDER error for ratelimited', async () => {
    const fetchMock = mockFetch({ ok: false, error: 'ratelimited' });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    const result = await t.send({ text: 'hi', to: '#x' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as any).code).toBe('PROVIDER');
  });

  it('returns PROVIDER error for unknown errors', async () => {
    const fetchMock = mockFetch({ ok: false, error: 'some_unknown_error' });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    const result = await t.send({ text: 'hi', to: '#x' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('some_unknown_error');
      expect((result.error as any).code).toBe('PROVIDER');
    }
  });

  it('uses custom baseUrl when provided', async () => {
    const fetchMock = mockFetch({ ok: true, ts: '1.5', channel: 'C1' });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test', baseUrl: 'https://custom.slack' });
    await t.send({ text: 'hi', to: '#x' }, ctx);

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe('https://custom.slack/chat.postMessage');
  });

  it('verify() calls auth.test and returns ok with details', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, url: 'https://team.slack.com', team: 'Team', user: 'bot' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    const result = await t.verify!();

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe('https://slack.com/api/auth.test');
    expect(result).toEqual({
      ok: true,
      details: { url: 'https://team.slack.com', team: 'Team', user: 'bot' },
    });
  });

  it('verify() returns not ok on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, error: 'invalid_auth' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-bad' });
    const result = await t.verify!();

    expect(result).toEqual({ ok: false, details: 'invalid_auth' });
  });

  it('handles success with missing ts/channel fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    const result = await t.send({ text: 'hi', to: '#x' }, ctx);

    expect(result).toEqual({ ok: true, data: { ts: '', channel: '' } });
  });

  it('rendered.to overrides defaultChannel', async () => {
    const fetchMock = mockFetch({ ok: true, ts: '1.6', channel: 'C_OVERRIDE' });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test', defaultChannel: '#fallback' });
    await t.send({ text: 'hi', to: '#override' }, ctx);

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body.channel).toBe('#override');
  });

  it('uploads file via 3-step flow when file is present', async () => {
    const fileData = Buffer.from('PDF content');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          upload_url: 'https://files.slack.com/upload/v1/abc',
          file_id: 'F123',
        }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, files: [{ id: 'F123', title: 'report.pdf' }] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    const result = await t.send(
      {
        text: 'Here is the report',
        to: '#docs',
        file: { data: fileData, filename: 'report.pdf' },
      },
      ctx,
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const getUrlCall = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(getUrlCall[0]).toBe('https://slack.com/api/files.getUploadURLExternal');
    const getUrlParams = new URLSearchParams(getUrlCall[1].body as string);
    expect(getUrlParams.get('filename')).toBe('report.pdf');
    expect(getUrlParams.get('length')).toBe(String(fileData.byteLength));

    const uploadCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(uploadCall[0]).toBe('https://files.slack.com/upload/v1/abc');
    expect(uploadCall[1].headers).toMatchObject({ 'Content-Type': 'application/octet-stream' });

    const completeCall = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(completeCall[0]).toBe('https://slack.com/api/files.completeUploadExternal');
    const completeBody = JSON.parse(completeCall[1].body as string);
    expect(completeBody).toEqual({
      files: [{ id: 'F123', title: 'report.pdf' }],
      channel_id: '#docs',
      initial_comment: 'Here is the report',
    });

    expect(result).toEqual({ ok: true, data: { ts: '', channel: '#docs' } });
  });

  it('file upload uses custom title when provided', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, upload_url: 'https://up.slack.com/x', file_id: 'F1' }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, files: [{ id: 'F1' }] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    await t.send(
      {
        text: 'see attached',
        to: '#ch',
        file: { data: Buffer.from('x'), filename: 'f.pdf', title: 'My Report' },
      },
      ctx,
    );

    const completeCall = fetchMock.mock.calls[2] as [string, RequestInit];
    const completeBody = JSON.parse(completeCall[1].body as string);
    expect(completeBody.files[0].title).toBe('My Report');
  });

  it('file upload includes thread_ts when threadTs is set', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, upload_url: 'https://up.slack.com/x', file_id: 'F1' }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, files: [{ id: 'F1' }] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    await t.send(
      {
        text: 'reply file',
        to: '#ch',
        threadTs: '111.222',
        file: { data: Buffer.from('x'), filename: 'f.txt' },
      },
      ctx,
    );

    const completeCall = fetchMock.mock.calls[2] as [string, RequestInit];
    const completeBody = JSON.parse(completeCall[1].body as string);
    expect(completeBody.thread_ts).toBe('111.222');
  });

  it('returns error when getUploadURLExternal fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: 'invalid_auth' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-bad' });
    const result = await t.send(
      { text: 'x', to: '#ch', file: { data: Buffer.from('x'), filename: 'f.txt' } },
      ctx,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('files.getUploadURLExternal');
      expect((result.error as any).code).toBe('CONFIG');
    }
  });

  it('returns error when completeUploadExternal fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, upload_url: 'https://up.slack.com/x', file_id: 'F1' }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, error: 'channel_not_found' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    const result = await t.send(
      { text: 'x', to: '#bad', file: { data: Buffer.from('x'), filename: 'f.txt' } },
      ctx,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('files.completeUploadExternal');
      expect((result.error as any).code).toBe('VALIDATION');
    }
  });

  it('file upload sends alt_txt when altText is provided', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, upload_url: 'https://up.slack.com/x', file_id: 'F1' }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, files: [{ id: 'F1' }] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    await t.send(
      {
        text: 'img',
        to: '#ch',
        file: { data: Buffer.from('x'), filename: 'img.png', altText: 'A screenshot' },
      },
      ctx,
    );

    const getUrlCall = fetchMock.mock.calls[0] as [string, RequestInit];
    const params = new URLSearchParams(getUrlCall[1].body as string);
    expect(params.get('alt_txt')).toBe('A screenshot');
  });

  it('file upload without text omits initial_comment', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, upload_url: 'https://up.slack.com/x', file_id: 'F1' }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, files: [{ id: 'F1' }] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    await t.send({ text: '', to: '#ch', file: { data: Buffer.from('x'), filename: 'f.txt' } }, ctx);

    const completeCall = fetchMock.mock.calls[2] as [string, RequestInit];
    const completeBody = JSON.parse(completeCall[1].body as string);
    expect(completeBody.initial_comment).toBeUndefined();
  });

  it('returns PROVIDER error when getUploadURLExternal has no error field', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    const result = await t.send(
      { text: 'x', to: '#ch', file: { data: Buffer.from('x'), filename: 'f.txt' } },
      ctx,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('unknown_error');
      expect((result.error as any).code).toBe('PROVIDER');
    }
  });

  it('returns PROVIDER error when completeUploadExternal has no error field', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, upload_url: 'https://up.slack.com/x', file_id: 'F1' }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    const result = await t.send(
      { text: 'x', to: '#ch', file: { data: Buffer.from('x'), filename: 'f.txt' } },
      ctx,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('unknown_error');
      expect((result.error as any).code).toBe('PROVIDER');
    }
  });

  it('returns PROVIDER error when chat.postMessage has no error field', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    const result = await t.send({ text: 'hi', to: '#x' }, ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('unknown_error');
      expect((result.error as any).code).toBe('PROVIDER');
    }
  });

  it('verify() falls back to unknown_error when error field is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    const result = await t.verify!();
    expect(result).toEqual({ ok: false, details: 'unknown_error' });
  });

  it('returns error when getUploadURLExternal returns incomplete metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    const result = await t.send(
      { text: 'x', to: '#ch', file: { data: Buffer.from('x'), filename: 'f.txt' } },
      ctx,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('incomplete upload metadata');
      expect((result.error as any).code).toBe('PROVIDER');
    }
  });

  it('returns error when file binary upload HTTP response is not ok', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, upload_url: 'https://up.slack.com/x', file_id: 'F1' }),
      })
      .mockResolvedValueOnce({ ok: false, status: 403 });
    vi.stubGlobal('fetch', fetchMock);

    const t = slackTransport({ token: 'xoxb-test' });
    const result = await t.send(
      { text: 'x', to: '#ch', file: { data: Buffer.from('x'), filename: 'f.txt' } },
      ctx,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('HTTP 403');
      expect((result.error as any).code).toBe('PROVIDER');
    }
  });
});

describe('mockSlackTransport', () => {
  it('falls back channel to mock-channel when rendered.to is undefined', async () => {
    const transport = mockSlackTransport();
    const result = await transport.send({ text: 'hi' }, ctx);

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.channel).toBe('mock-channel');
    expect(transport.messages[0]).toMatchObject({ text: 'hi' });
  });
});
