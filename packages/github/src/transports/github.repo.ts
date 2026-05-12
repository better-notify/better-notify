import { NotifyRpcError } from '@betternotify/core';
import type { RenderedGithub } from '../types.js';

export const parseRepo = (repo: string): { owner: string; name: string } | null => {
  const parts = repo.split('/');
  if (parts.length !== 2) return null;
  const owner = parts[0]?.trim();
  const name = parts[1]?.trim();
  if (!owner || !name) return null;
  return { owner, name };
};

export const resolveRepo = (
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
