import { NotifyRpcProviderError } from '@betternotify/core';
import type {
  RenderedGithubIssue,
  RenderedGithubIssueComment,
  RenderedGithubPrComment,
  RenderedGithubPrLineComment,
  RenderedGithubPrReview,
} from '../types.js';
import type { GithubTransportData } from './types.js';
import type { GithubClientCtx } from './github.types.js';
import { buildError, type GithubErrorResponse } from './github.errors.js';

type ActionResult =
  | { ok: true; data: GithubTransportData }
  | { ok: false; error: NotifyRpcProviderError };

type SendCtx = { route: string; messageId: string };

const malformedResponse = (method: string, fields: string, ctx: SendCtx): NotifyRpcProviderError =>
  new NotifyRpcProviderError({
    message: `GitHub ${method}: malformed response — missing ${fields}`,
    code: 'PROVIDER',
    provider: 'github',
    retriable: false,
    route: ctx.route,
    messageId: ctx.messageId,
  });

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

export const createIssue = async (
  client: GithubClientCtx,
  rendered: RenderedGithubIssue,
  owner: string,
  name: string,
  ctx: SendCtx,
): Promise<ActionResult> => {
  const url = `${client.baseUrl}/repos/${owner}/${name}/issues`;
  const body: Record<string, unknown> = {
    title: rendered.title,
    body: rendered.body,
  };
  if (rendered.labels) body.labels = rendered.labels;
  if (rendered.assignees) body.assignees = rendered.assignees;
  if (rendered.milestone !== undefined) body.milestone = rendered.milestone;

  client.log.debug('creating GitHub issue', { repo: `${owner}/${name}` });
  const result = await client.http.request<GithubIssueResponse, GithubErrorResponse>(url, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(body),
  });

  if (!result.ok) {
    return { ok: false, error: buildError(client.log, 'POST /issues', result, ctx) };
  }

  const data = result.data;

  if (!data?.number || !data.html_url) {
    return { ok: false, error: malformedResponse('POST /issues', 'number/html_url', ctx) };
  }

  return {
    ok: true as const,
    data: { action: 'issue', number: data.number, url: data.html_url },
  };
};

export const createIssueComment = async (
  client: GithubClientCtx,
  rendered: RenderedGithubIssueComment,
  owner: string,
  name: string,
  ctx: SendCtx,
): Promise<ActionResult> => {
  const url = `${client.baseUrl}/repos/${owner}/${name}/issues/${rendered.issueNumber}/comments`;

  client.log.debug('creating GitHub issue comment', {
    repo: `${owner}/${name}`,
    issueNumber: rendered.issueNumber,
  });
  const result = await client.http.request<GithubCommentResponse, GithubErrorResponse>(url, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify({ body: rendered.body }),
  });

  if (!result.ok) {
    return { ok: false, error: buildError(client.log, 'POST /issues/comments', result, ctx) };
  }

  const data = result.data;
  if (!data?.id || !data.html_url) {
    return { ok: false, error: malformedResponse('POST /issues/comments', 'id/html_url', ctx) };
  }
  return {
    ok: true as const,
    data: { action: 'comment', id: data.id, url: data.html_url },
  };
};

export const createPrComment = async (
  client: GithubClientCtx,
  rendered: RenderedGithubPrComment,
  owner: string,
  name: string,
  ctx: SendCtx,
): Promise<ActionResult> => {
  const url = `${client.baseUrl}/repos/${owner}/${name}/issues/${rendered.prNumber}/comments`;

  client.log.debug('creating GitHub PR comment', {
    repo: `${owner}/${name}`,
    prNumber: rendered.prNumber,
  });

  const result = await client.http.request<GithubCommentResponse, GithubErrorResponse>(url, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify({ body: rendered.body }),
  });

  if (!result.ok) {
    return { ok: false, error: buildError(client.log, 'POST /issues/comments', result, ctx) };
  }

  const data = result.data;

  if (!data?.id || !data.html_url) {
    return { ok: false, error: malformedResponse('POST /issues/comments', 'id/html_url', ctx) };
  }

  return {
    ok: true as const,
    data: { action: 'pr-comment' as const, id: data.id, url: data.html_url },
  };
};

export const createPrLineComment = async (
  client: GithubClientCtx,
  rendered: RenderedGithubPrLineComment,
  owner: string,
  name: string,
  ctx: SendCtx,
): Promise<ActionResult> => {
  const url = `${client.baseUrl}/repos/${owner}/${name}/pulls/${rendered.prNumber}/comments`;

  const body: Record<string, unknown> = {
    body: rendered.body,
    commit_id: rendered.commitId,
    path: rendered.path,
  };

  if (rendered.line !== undefined) body.line = rendered.line;
  if (rendered.startLine !== undefined) body.start_line = rendered.startLine;
  if (rendered.side !== undefined) body.side = rendered.side;
  if (rendered.startSide !== undefined) body.start_side = rendered.startSide;
  if (rendered.subjectType !== undefined) body.subject_type = rendered.subjectType;

  client.log.debug('creating GitHub PR line comment', {
    repo: `${owner}/${name}`,
    prNumber: rendered.prNumber,
    path: rendered.path,
  });

  const result = await client.http.request<GithubCommentResponse, GithubErrorResponse>(url, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify(body),
  });

  if (!result.ok) {
    return { ok: false, error: buildError(client.log, 'POST /pulls/comments', result, ctx) };
  }

  const data = result.data;

  if (!data?.id || !data.html_url) {
    return { ok: false, error: malformedResponse('POST /pulls/comments', 'id/html_url', ctx) };
  }

  return {
    ok: true as const,
    data: { action: 'pr-line-comment' as const, id: data.id, url: data.html_url },
  };
};

export const createPrReview = async (
  client: GithubClientCtx,
  rendered: RenderedGithubPrReview,
  owner: string,
  name: string,
  ctx: SendCtx,
): Promise<ActionResult> => {
  const url = `${client.baseUrl}/repos/${owner}/${name}/pulls/${rendered.prNumber}/reviews`;

  client.log.debug('creating GitHub PR review', {
    repo: `${owner}/${name}`,
    prNumber: rendered.prNumber,
    event: rendered.event,
  });

  const result = await client.http.request<GithubPrReviewResponse, GithubErrorResponse>(url, {
    method: 'POST',
    headers: client.headers,
    body: JSON.stringify({ body: rendered.body, event: rendered.event }),
  });

  if (!result.ok) {
    return { ok: false, error: buildError(client.log, 'POST /reviews', result, ctx) };
  }

  const data = result.data;

  if (!data?.id || !data.html_url) {
    return { ok: false, error: malformedResponse('POST /reviews', 'id/html_url', ctx) };
  }

  return {
    ok: true as const,
    data: { action: 'pr-review', id: data.id, url: data.html_url },
  };
};
