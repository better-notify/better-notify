import { createNotify, createClient } from '@betternotify/core';
import { githubChannel, githubTransport } from '@betternotify/github';
import { z } from 'zod';
import { env } from '../env';

export const runGithubIssue = async (): Promise<void> => {
  const rpc = createNotify({
    channels: { github: githubChannel({ defaults: { repo: env.GITHUB_REPO } }) },
  });

  const catalog = rpc.catalog({
    bugReport: rpc
      .github()
      .issue()
      .input(
        z.object({
          summary: z.string(),
          details: z.string(),
          severity: z.enum(['low', 'medium', 'high', 'critical']),
        }),
      )
      .title(({ input }) => `[${input.severity.toUpperCase()}] ${input.summary}`)
      .body(
        ({ input }) =>
          `## Bug Report\n\n**Severity:** ${input.severity}\n\n### Description\n\n${input.details}`,
      ),
  });

  const transport = githubTransport({ token: env.GITHUB_TOKEN });

  const notify = createClient({
    catalog,
    channels: { github: githubChannel({ defaults: { repo: env.GITHUB_REPO } }) },
    transportsByChannel: { github: transport },
  });

  const result = await notify.bugReport.send({
    input: {
      summary: 'Login page 500 error',
      details: 'Users see a 500 error when trying to log in with SSO.',
      severity: 'critical',
    },
    labels: ['bug', 'critical'],
    assignees: ['octocat'],
  });

  console.log('issue created:', { messageId: result.messageId, data: result.data });

  const batchResult = await notify.bugReport.batch([
    {
      input: { summary: 'Typo in footer', details: 'Small typo.', severity: 'low' },
      labels: ['bug', 'low-priority'],
    },
    {
      input: {
        summary: 'Broken link on docs',
        details: 'Link to API docs 404s.',
        severity: 'medium',
      },
      labels: ['bug', 'docs'],
    },
  ]);

  console.log(`batch: ${batchResult.okCount} ok / ${batchResult.errorCount} errors`);
};
