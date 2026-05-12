import { createNotify, createClient } from '@betternotify/core';
import { githubChannel, githubTransport } from '@betternotify/github';
import { z } from 'zod';
import { env } from '../env';

export const runGithubPrReview = async (): Promise<void> => {
  const rpc = createNotify({
    channels: { github: githubChannel({ defaults: { repo: env.GITHUB_REPO } }) },
  });

  const catalog = rpc.catalog({
    releaseApproval: rpc
      .github()
      .prReview()
      .input(z.object({ version: z.string(), notes: z.string() }))
      .body(
        ({ input }) =>
          `Approved for release **${input.version}**.\n\n### Release Notes\n\n${input.notes}`,
      ),
  });

  const transport = githubTransport({ token: env.GITHUB_TOKEN });

  const notify = createClient({
    catalog,
    channels: { github: githubChannel({ defaults: { repo: env.GITHUB_REPO } }) },
    transportsByChannel: { github: transport },
  });

  const result = await notify.releaseApproval.send({
    input: { version: 'v2.0.0', notes: 'New auth flow, SSO fix, performance improvements.' },
    prNumber: env.GITHUB_PR_NUMBER,
    event: 'APPROVE',
  });

  console.log('PR review submitted:', { messageId: result.messageId, data: result.data });
};
