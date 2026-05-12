import { createNotify, createClient } from '@betternotify/core';
import { githubChannel, githubTransport } from '@betternotify/github';
import { z } from 'zod';
import { env } from '../env';

export const runGithubPrLineComment = async (): Promise<void> => {
  const rpc = createNotify({
    channels: { github: githubChannel({ defaults: { repo: env.GITHUB_REPO } }) },
  });

  const catalog = rpc.catalog({
    codeNote: rpc
      .github()
      .prLineComment()
      .input(z.object({ note: z.string() }))
      .body(({ input }) => input.note),
  });

  const transport = githubTransport({ token: env.GITHUB_TOKEN });

  const notify = createClient({
    catalog,
    channels: { github: githubChannel({ defaults: { repo: env.GITHUB_REPO } }) },
    transportsByChannel: { github: transport },
  });

  const result = await notify.codeNote.send({
    input: { note: 'This needs a null check.' },
    prNumber: env.GITHUB_PR_NUMBER,
    commitId: 'abc123',
    path: 'src/index.ts',
    line: 42,
  });

  console.log('PR line comment posted:', { messageId: result.messageId, data: result.data });
};
