import { describe, expect, it, vi, afterEach } from 'vitest';
import { NotifyRpcProviderError } from '@betternotify/core';
import { githubTransport } from './github.js';
import { mockGithubTransport } from './mock.js';

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const ctx = { route: 'test.route', messageId: 'msg-1', attempt: 1 };

describe('githubTransport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('issue', () => {
    it('creates an issue via POST /repos/{owner}/{repo}/issues', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ number: 42, html_url: 'https://github.com/org/repo/issues/42' }, 201),
        );
      vi.stubGlobal('fetch', fetchMock);

      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send(
        {
          action: 'issue',
          title: 'Bug report',
          body: 'Something broke',
          repo: 'org/repo',
          labels: ['bug'],
          assignees: ['user1'],
          milestone: 1,
        },
        ctx,
      );

      expect(fetchMock).toHaveBeenCalledOnce();
      const call = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(String(call[0])).toBe('https://api.github.com/repos/org/repo/issues');
      const reqHeaders = new Headers(call[1].headers as Record<string, string>);
      expect(reqHeaders.get('Authorization')).toBe('Bearer ghp_test');
      expect(reqHeaders.get('Accept')).toBe('application/vnd.github+json');
      const body = JSON.parse(call[1].body as string);
      expect(body).toEqual({
        title: 'Bug report',
        body: 'Something broke',
        labels: ['bug'],
        assignees: ['user1'],
        milestone: 1,
      });
      expect(result).toEqual({
        ok: true,
        data: { action: 'issue', number: 42, url: 'https://github.com/org/repo/issues/42' },
      });
    });

    it('omits optional fields when not provided', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ number: 1, html_url: 'https://github.com/a/b/issues/1' }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const t = githubTransport({ token: 'ghp_test' });
      await t.send({ action: 'issue', title: 'T', body: 'B', repo: 'a/b' }, ctx);

      const call = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(call[1].body as string);
      expect(body).toEqual({ title: 'T', body: 'B' });
    });
  });

  describe('comment', () => {
    it('creates a comment via POST /repos/{owner}/{repo}/issues/{number}/comments', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({
          id: 999,
          html_url: 'https://github.com/org/repo/issues/42#issuecomment-999',
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send(
        { action: 'comment', body: 'LGTM', repo: 'org/repo', issueNumber: 42 },
        ctx,
      );

      const call = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(String(call[0])).toBe('https://api.github.com/repos/org/repo/issues/42/comments');
      const body = JSON.parse(call[1].body as string);
      expect(body).toEqual({ body: 'LGTM' });
      expect(result).toEqual({
        ok: true,
        data: {
          action: 'comment',
          id: 999,
          url: 'https://github.com/org/repo/issues/42#issuecomment-999',
        },
      });
    });
  });

  describe('pr-review', () => {
    it('creates a review via POST /repos/{owner}/{repo}/pulls/{number}/reviews', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({
          id: 555,
          html_url: 'https://github.com/org/repo/pull/10#pullrequestreview-555',
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send(
        {
          action: 'pr-review',
          body: 'Ship it',
          repo: 'org/repo',
          prNumber: 10,
          event: 'APPROVE',
        },
        ctx,
      );

      const call = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(String(call[0])).toBe('https://api.github.com/repos/org/repo/pulls/10/reviews');
      const body = JSON.parse(call[1].body as string);
      expect(body).toEqual({ body: 'Ship it', event: 'APPROVE' });
      expect(result).toEqual({
        ok: true,
        data: {
          action: 'pr-review',
          id: 555,
          url: 'https://github.com/org/repo/pull/10#pullrequestreview-555',
        },
      });
    });
  });

  describe('pr-review error', () => {
    it('returns error when pr review API call fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ message: 'Not Found' }, 404)),
      );

      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send(
        {
          action: 'pr-review',
          body: 'review',
          repo: 'org/repo',
          prNumber: 999,
          event: 'APPROVE' as const,
        },
        ctx,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcProviderError;
        expect(err.code).toBe('CONFIG');
        expect(err.message).toContain('POST /reviews');
      }
    });
  });

  describe('repo from rendered', () => {
    it('uses repo from rendered object', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ number: 1, html_url: 'https://github.com/org/repo/issues/1' }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const t = githubTransport({ token: 'ghp_test' });
      await t.send({ action: 'issue', title: 'T', body: 'B', repo: 'org/repo' }, ctx);

      const call = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(String(call[0])).toBe('https://api.github.com/repos/org/repo/issues');
    });
  });

  describe('repo validation', () => {
    it('returns VALIDATION error when no repo is resolved', async () => {
      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send({ action: 'issue', title: 'T', body: 'B' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('No repo resolved');
      }
    });

    it('returns VALIDATION error for malformed repo string', async () => {
      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send(
        { action: 'issue', title: 'T', body: 'B', repo: 'no-slash' },
        ctx,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid repo format');
      }
    });

    it('returns VALIDATION error for repo with empty parts', async () => {
      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send({ action: 'issue', title: 'T', body: 'B', repo: '/repo' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid repo format');
      }
    });

    it('returns VALIDATION error for repo with too many slashes', async () => {
      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send({ action: 'issue', title: 'T', body: 'B', repo: 'a/b/c' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid repo format');
      }
    });
  });

  describe('error handling', () => {
    it('returns CONFIG error for 401', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ message: 'Bad credentials' }, 401)),
      );

      const t = githubTransport({ token: 'ghp_bad' });
      const result = await t.send(
        { action: 'issue', title: 'T', body: 'B', repo: 'org/repo' },
        ctx,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(NotifyRpcProviderError);
        const err = result.error as NotifyRpcProviderError;
        expect(err.code).toBe('CONFIG');
        expect(err.provider).toBe('github');
        expect(err.httpStatus).toBe(401);
        expect(err.retriable).toBe(false);
        expect(err.message).toContain('Bad credentials');
      }
    });

    it('returns CONFIG error for 403', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ message: 'Forbidden' }, 403)),
      );

      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send(
        { action: 'issue', title: 'T', body: 'B', repo: 'org/repo' },
        ctx,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcProviderError;
        expect(err.code).toBe('CONFIG');
        expect(err.retriable).toBe(false);
      }
    });

    it('returns CONFIG error for 404', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ message: 'Not Found' }, 404)),
      );

      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send(
        { action: 'comment', body: 'hi', repo: 'org/repo', issueNumber: 999 },
        ctx,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcProviderError;
        expect(err.code).toBe('CONFIG');
        expect(err.retriable).toBe(false);
      }
    });

    it('returns VALIDATION error for 422', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          jsonResponse(
            {
              message: 'Validation Failed',
              errors: [{ resource: 'Issue', code: 'missing_field' }],
            },
            422,
          ),
        ),
      );

      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send({ action: 'issue', title: '', body: '', repo: 'org/repo' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcProviderError;
        expect(err.code).toBe('VALIDATION');
        expect(err.retriable).toBe(false);
      }
    });

    it('returns RATE_LIMITED error for 429', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ message: 'rate limit exceeded' }, 429)),
      );

      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send(
        { action: 'issue', title: 'T', body: 'B', repo: 'org/repo' },
        ctx,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcProviderError;
        expect(err.code).toBe('RATE_LIMITED');
        expect(err.retriable).toBe(true);
      }
    });

    it('returns PROVIDER error for 500', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ message: 'Internal Server Error' }, 500)),
      );

      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send(
        { action: 'issue', title: 'T', body: 'B', repo: 'org/repo' },
        ctx,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcProviderError;
        expect(err.code).toBe('PROVIDER');
        expect(err.retriable).toBe(true);
      }
    });

    it('handles HTTP error without message in body', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, 500)));

      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send(
        { action: 'issue', title: 'T', body: 'B', repo: 'org/repo' },
        ctx,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcProviderError;
        expect(err.message).toContain('500');
      }
    });

    it('handles network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send(
        { action: 'issue', title: 'T', body: 'B', repo: 'org/repo' },
        ctx,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcProviderError;
        expect(err.message).toContain('network error');
        expect(err.code).toBe('PROVIDER');
        expect(err.retriable).toBe(true);
      }
    });

    it('handles timeout', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')));

      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send(
        { action: 'issue', title: 'T', body: 'B', repo: 'org/repo' },
        ctx,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcProviderError;
        expect(err.message).toContain('request timed out');
        expect(err.code).toBe('TIMEOUT');
        expect(err.retriable).toBe(true);
      }
    });
  });

  describe('custom http options', () => {
    it('uses provided http.timeoutMs', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ number: 1, html_url: 'https://github.com/a/b/issues/1' }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const t = githubTransport({ token: 'ghp_test', http: { timeoutMs: 5000 } });
      const result = await t.send({ action: 'issue', title: 'T', body: 'B', repo: 'a/b' }, ctx);

      expect(result.ok).toBe(true);
    });
  });

  describe('null response data fallbacks', () => {
    it('falls back to defaults when issue response body is empty', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response('', { status: 201, headers: { 'Content-Type': 'application/json' } }),
          ),
      );

      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send(
        { action: 'issue', title: 'T', body: 'B', repo: 'org/repo' },
        ctx,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ action: 'issue', number: 0, url: '' });
      }
    });

    it('falls back to defaults when comment response body is empty', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response('', { status: 201, headers: { 'Content-Type': 'application/json' } }),
          ),
      );

      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send(
        { action: 'comment', body: 'hi', repo: 'org/repo', issueNumber: 1 },
        ctx,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ action: 'comment', id: 0, url: '' });
      }
    });

    it('falls back to defaults when pr-review response body is empty', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response('', { status: 201, headers: { 'Content-Type': 'application/json' } }),
          ),
      );

      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.send(
        {
          action: 'pr-review',
          body: 'ok',
          repo: 'org/repo',
          prNumber: 1,
          event: 'APPROVE' as const,
        },
        ctx,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({ action: 'pr-review', id: 0, url: '' });
      }
    });
  });

  describe('custom baseUrl', () => {
    it('uses custom baseUrl when provided', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ number: 1, html_url: 'https://ghe/issues/1' }));
      vi.stubGlobal('fetch', fetchMock);

      const t = githubTransport({
        token: 'ghp_test',
        baseUrl: 'https://ghe.corp.com/api/v3',
      });
      await t.send({ action: 'issue', title: 'T', body: 'B', repo: 'org/repo' }, ctx);

      const call = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(String(call[0])).toBe('https://ghe.corp.com/api/v3/repos/org/repo/issues');
    });
  });

  describe('verify', () => {
    it('returns ok with login details', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ login: 'bot-user' })));

      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.verify!();

      expect(result).toEqual({ ok: true, details: { login: 'bot-user' } });
    });

    it('returns not ok on 401', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ message: 'Bad credentials' }, 401)),
      );

      const t = githubTransport({ token: 'ghp_bad' });
      const result = await t.verify!();

      expect(result).toEqual({ ok: false, details: 'Bad credentials' });
    });

    it('returns unknown error when HTTP error body has no message', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response('', { status: 401, headers: { 'Content-Type': 'application/json' } }),
          ),
      );

      const t = githubTransport({ token: 'ghp_bad' });
      const result = await t.verify!();

      expect(result).toEqual({ ok: false, details: 'unknown error' });
    });

    it('returns not ok on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

      const t = githubTransport({ token: 'ghp_test' });
      const result = await t.verify!();

      expect(result).toEqual({ ok: false, details: 'network error: fetch failed' });
    });
  });
});

describe('mockGithubTransport', () => {
  it('records issue messages', async () => {
    const t = mockGithubTransport();
    const result = await t.send({ action: 'issue', title: 'T', body: 'B', repo: 'org/repo' }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        action: 'issue',
        number: 1,
        url: 'https://github.com/mock/repo/issues/1',
      });
    }
    expect(t.messages).toHaveLength(1);
    expect(t.messages[0]).toMatchObject({ action: 'issue', title: 'T', body: 'B' });
  });

  it('records comment messages', async () => {
    const t = mockGithubTransport();
    const result = await t.send(
      { action: 'comment', body: 'hi', repo: 'org/repo', issueNumber: 5 },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.action).toBe('comment');
    }
    expect(t.messages[0]).toMatchObject({ action: 'comment', body: 'hi' });
  });

  it('records pr-review messages', async () => {
    const t = mockGithubTransport();
    const result = await t.send(
      { action: 'pr-review', body: 'LGTM', repo: 'org/repo', prNumber: 10, event: 'APPROVE' },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.action).toBe('pr-review');
    }
    expect(t.messages[0]).toMatchObject({ action: 'pr-review', body: 'LGTM' });
  });

  it('increments counter across calls', async () => {
    const t = mockGithubTransport();
    await t.send({ action: 'issue', title: 'T1', body: 'B1', repo: 'org/repo' }, ctx);
    await t.send({ action: 'issue', title: 'T2', body: 'B2', repo: 'org/repo' }, ctx);

    expect(t.messages).toHaveLength(2);
    const first = t.messages[0];
    const second = t.messages[1];
    if (!first || !second) throw new Error('expected 2 messages');
    expect(first.id).toBe('github-mock-1');
    expect(second.id).toBe('github-mock-2');
  });
});
