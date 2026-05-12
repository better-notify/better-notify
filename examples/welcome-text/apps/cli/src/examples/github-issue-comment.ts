import { createNotify, createClient } from '@betternotify/core';
import { githubChannel, githubTransport } from '@betternotify/github';
import { z } from 'zod';
import { env } from '../env';

export const runGithubIssueComment = async (): Promise<void> => {
  const rpc = createNotify({
    channels: { github: githubChannel({ defaults: { repo: env.GITHUB_REPO } }) },
  });

  const catalog = rpc.catalog({
    reviewAck: rpc
      .github()
      .issueComment()
      .input(z.object({ reviewer: z.string(), message: z.string() }))
      .body(({ input }) => `**${input.reviewer}** commented:\n\n${input.message}`),
  });

  const transport = githubTransport({ token: env.GITHUB_TOKEN });

  const notify = createClient({
    catalog,
    transportsByChannel: { github: transport },
  });

  const result = await notify.reviewAck.send({
    input: { reviewer: 'octocat', message: 'Looking into this now.' },
    issueNumber: 1,
  });

  console.log('issue comment posted:', { messageId: result.messageId, data: result.data });
};
