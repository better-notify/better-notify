import { createNotify, createClient } from '@betternotify/core';
import { githubChannel, githubTransport } from '@betternotify/github';
import { z } from 'zod';
import { env } from '../env';

export const runGithubPrComment = async (): Promise<void> => {
  const rpc = createNotify({
    channels: { github: githubChannel({ defaults: { repo: env.GITHUB_REPO } }) },
  });

  const catalog = rpc.catalog({
    ciFeedback: rpc
      .github()
      .prComment()
      .input(z.object({ message: z.string() }))
      .body(({ input }) => input.message),
  });

  const transport = githubTransport({ token: env.GITHUB_TOKEN });

  const notify = createClient({
    catalog,
    channels: { github: githubChannel({ defaults: { repo: env.GITHUB_REPO } }) },
    transportsByChannel: { github: transport },
  });

  const result = await notify.ciFeedback.send({
    input: { message: 'All checks passed. Ready to merge.' },
    prNumber: env.GITHUB_PR_NUMBER,
  });

  console.log('PR comment posted:', { messageId: result.messageId, data: result.data });
};
