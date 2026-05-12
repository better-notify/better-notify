import { consoleLogger, NotifyRpcError } from '@betternotify/core';
import { createTransport, createHttpClient } from '@betternotify/core/transports';
import type { RenderedGithub } from '../types.js';
import type { GithubTransportData, Transport } from './types.js';
import type { GithubTransportOptions, GithubClientCtx } from './github.types.js';
import type { GithubErrorResponse } from './github.errors.js';
import { resolveRepo } from './github.repo.js';
import {
  createIssue,
  createIssueComment,
  createPrComment,
  createPrLineComment,
  createPrReview,
} from './github.actions.js';

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_BASE_URL = 'https://api.github.com';

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

  const client: GithubClientCtx = { baseUrl, http, headers, log };

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
          return createIssue(client, rendered, owner, name, ctx);
        case 'comment':
          return createIssueComment(client, rendered, owner, name, ctx);
        case 'pr-comment':
          return createPrComment(client, rendered, owner, name, ctx);
        case 'pr-line-comment':
          return createPrLineComment(client, rendered, owner, name, ctx);
        case 'pr-review':
          return createPrReview(client, rendered, owner, name, ctx);
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

      const login = result.data?.login;
      if (!login) {
        return { ok: false, details: 'invalid GitHub verify response: missing login' };
      }
      return { ok: true, details: { login } };
    },
  });
};
