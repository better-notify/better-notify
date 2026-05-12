import { consoleLogger, NotifyRpcError, NotifyRpcProviderError } from '@betternotify/core';
import { createTransport, createHttpClient, mapHttpStatus } from '@betternotify/core/transports';
import type { HttpNetworkError, HttpStatusError } from '@betternotify/core/transports';
import type {
  RenderedGithub,
  RenderedGithubIssue,
  RenderedGithubComment,
  RenderedGithubPrReview,
} from '../types.js';
import type { GithubTransportData, Transport } from './types.js';
import type { GithubTransportOptions } from './github.types.js';

type GithubIssueResponse = {
  number: number;
  html_url: string;
};

type GithubCommentResponse = {
  id: number;
  html_url: string;
};

type GithubPrReviewResponse = {
  id: number;
  html_url: string;
};

type GithubErrorResponse = {
  message: string;
  errors?: { resource?: string; code?: string; field?: string; message?: string }[];
  documentation_url?: string;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_BASE_URL = 'https://api.github.com';

const parseRepo = (repo: string): { owner: string; name: string } | null => {
  const parts = repo.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], name: parts[1] };
};

export const githubTransport = (opts: GithubTransportOptions): Transport => {
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = opts.http?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const log = (opts.logger ?? consoleLogger()).child({ component: 'github' });
  const http = createHttpClient({ ...opts.http, timeoutMs });

  const headers = {
    Authorization: `Bearer ${opts.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  const buildNetworkError = (
    method: string,
    result: HttpNetworkError,
    ctx: { route: string; messageId: string },
  ): NotifyRpcProviderError => {
    const detail = result.timedOut ? 'request timed out' : `network error: ${result.cause.message}`;
    return new NotifyRpcProviderError({
      message: `GitHub ${method}: ${detail}`,
      code: result.timedOut ? 'TIMEOUT' : 'PROVIDER',
      provider: 'github',
      retriable: true,
      cause: result.cause,
      route: ctx.route,
      messageId: ctx.messageId,
    });
  };

  const buildHttpError = (
    method: string,
    result: HttpStatusError<GithubErrorResponse | null>,
    ctx: { route: string; messageId: string },
  ): NotifyRpcProviderError => {
    const { code, retriable } = mapHttpStatus(result.status);
    const detail = result.body?.message ?? `${result.status} ${result.statusText}`;
    log.error('GitHub API error', {
      err: new Error(detail),
      route: ctx.route,
      status: result.status,
    });
    return new NotifyRpcProviderError({
      message: `GitHub ${method}: ${detail}`,
      code,
      provider: 'github',
      httpStatus: result.status,
      retriable,
      route: ctx.route,
      messageId: ctx.messageId,
    });
  };

  const buildError = (
    method: string,
    result: HttpNetworkError | HttpStatusError<GithubErrorResponse | null>,
    ctx: { route: string; messageId: string },
  ): NotifyRpcProviderError => {
    if (result.kind === 'network') return buildNetworkError(method, result, ctx);
    return buildHttpError(method, result, ctx);
  };

  const resolveRepo = (
    rendered: RenderedGithub,
    ctx: { route: string; messageId: string },
  ): { owner: string; name: string } | NotifyRpcError => {
    const repoStr = rendered.repo;
    if (!repoStr) {
      return new NotifyRpcError({
        message: 'No repo resolved: set "repo" in send args or "defaults.repo" in channel options',
        code: 'VALIDATION',
        route: ctx.route,
        messageId: ctx.messageId,
      });
    }
    const parsed = parseRepo(repoStr);
    if (!parsed) {
      return new NotifyRpcError({
        message: `Invalid repo format "${repoStr}": expected "owner/repo"`,
        code: 'VALIDATION',
        route: ctx.route,
        messageId: ctx.messageId,
      });
    }
    return parsed;
  };

  const createIssue = async (
    rendered: RenderedGithubIssue,
    owner: string,
    name: string,
    ctx: { route: string; messageId: string },
  ): Promise<
    { ok: true; data: GithubTransportData } | { ok: false; error: NotifyRpcProviderError }
  > => {
    const url = `${baseUrl}/repos/${owner}/${name}/issues`;
    const body: Record<string, unknown> = {
      title: rendered.title,
      body: rendered.body,
    };
    if (rendered.labels) body.labels = rendered.labels;
    if (rendered.assignees) body.assignees = rendered.assignees;
    if (rendered.milestone !== undefined) body.milestone = rendered.milestone;

    log.debug('creating GitHub issue', { repo: `${owner}/${name}` });
    const result = await http.request<GithubIssueResponse, GithubErrorResponse>(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!result.ok) {
      return { ok: false, error: buildError('POST /issues', result, ctx) };
    }

    const data = result.data;
    return {
      ok: true as const,
      data: {
        action: 'issue',
        number: data?.number ?? 0,
        url: data?.html_url ?? '',
      },
    };
  };

  const createComment = async (
    rendered: RenderedGithubComment,
    owner: string,
    name: string,
    ctx: { route: string; messageId: string },
  ): Promise<
    { ok: true; data: GithubTransportData } | { ok: false; error: NotifyRpcProviderError }
  > => {
    const url = `${baseUrl}/repos/${owner}/${name}/issues/${rendered.issueNumber}/comments`;

    log.debug('creating GitHub comment', {
      repo: `${owner}/${name}`,
      issueNumber: rendered.issueNumber,
    });
    const result = await http.request<GithubCommentResponse, GithubErrorResponse>(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: rendered.body }),
    });

    if (!result.ok) {
      return { ok: false, error: buildError('POST /comments', result, ctx) };
    }

    const data = result.data;
    return {
      ok: true as const,
      data: {
        action: 'comment',
        id: data?.id ?? 0,
        url: data?.html_url ?? '',
      },
    };
  };

  const createPrReview = async (
    rendered: RenderedGithubPrReview,
    owner: string,
    name: string,
    ctx: { route: string; messageId: string },
  ): Promise<
    { ok: true; data: GithubTransportData } | { ok: false; error: NotifyRpcProviderError }
  > => {
    const url = `${baseUrl}/repos/${owner}/${name}/pulls/${rendered.prNumber}/reviews`;

    log.debug('creating GitHub PR review', {
      repo: `${owner}/${name}`,
      prNumber: rendered.prNumber,
      event: rendered.event,
    });
    const result = await http.request<GithubPrReviewResponse, GithubErrorResponse>(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: rendered.body, event: rendered.event }),
    });

    if (!result.ok) {
      return { ok: false, error: buildError('POST /reviews', result, ctx) };
    }

    const data = result.data;
    return {
      ok: true as const,
      data: {
        action: 'pr-review',
        id: data?.id ?? 0,
        url: data?.html_url ?? '',
      },
    };
  };

  return createTransport<RenderedGithub, GithubTransportData>({
    name: 'github',

    async send(rendered, ctx) {
      const repoOrErr = resolveRepo(rendered, ctx);
      if (repoOrErr instanceof NotifyRpcError) {
        return { ok: false, error: repoOrErr };
      }
      const { owner, name } = repoOrErr;

      switch (rendered.action) {
        case 'issue':
          return createIssue(rendered, owner, name, ctx);
        case 'comment':
          return createComment(rendered, owner, name, ctx);
        case 'pr-review':
          return createPrReview(rendered, owner, name, ctx);
      }
    },

    async verify() {
      const result = await http.request<{ login: string }, GithubErrorResponse>(`${baseUrl}/user`, {
        method: 'GET',
        headers,
      });

      if (!result.ok) {
        const detail =
          result.kind === 'network'
            ? `network error: ${result.cause.message}`
            : (result.body?.message ?? 'unknown error');
        return { ok: false, details: detail };
      }

      return { ok: true, details: { login: result.data?.login } };
    },
  });
};
