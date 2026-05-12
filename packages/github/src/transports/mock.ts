import { createMockTransport } from '@betternotify/core/transports';
import type { MockTransport as CoreMockTransport } from '@betternotify/core/transports';
import type { RenderedGithub } from '../types.js';
import type { GithubTransportData } from './types.js';

export type MockGithubTransport = CoreMockTransport<RenderedGithub, GithubTransportData> & {
  readonly messages: ReadonlyArray<RenderedGithub & { id: string }>;
};

export const mockGithubTransport = (): MockGithubTransport => {
  let counter = 0;
  const messages: Array<RenderedGithub & { id: string }> = [];
  const base = createMockTransport<RenderedGithub, GithubTransportData>({
    name: 'mock-github',
    reply: (rendered) => {
      counter += 1;
      const id = `github-mock-${counter}`;
      messages.push({ ...rendered, id });

      switch (rendered.action) {
        case 'issue':
          return {
            action: 'issue',
            number: counter,
            url: `https://github.com/mock/repo/issues/${counter}`,
          };
        case 'comment':
          return {
            action: 'comment',
            id: counter,
            url: `https://github.com/mock/repo/issues/${rendered.issueNumber}#issuecomment-${counter}`,
          };
        case 'pr-comment':
          return {
            action: 'pr-comment',
            id: counter,
            url: `https://github.com/mock/repo/pull/${rendered.prNumber}#issuecomment-${counter}`,
          };
        case 'pr-line-comment':
          return {
            action: 'pr-line-comment',
            id: counter,
            url: `https://github.com/mock/repo/pull/${rendered.prNumber}#discussion_r${counter}`,
          };
        case 'pr-review':
          return {
            action: 'pr-review',
            id: counter,
            url: `https://github.com/mock/repo/pull/${rendered.prNumber}#pullrequestreview-${counter}`,
          };
      }
    },
  });
  return Object.assign(base, {
    get messages() {
      return messages;
    },
  });
};
