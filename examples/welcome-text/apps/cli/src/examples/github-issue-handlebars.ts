import Handlebars from 'handlebars';
import { createNotify, createClient } from '@betternotify/core';
import { githubChannel, githubTransport } from '@betternotify/github';
import { z } from 'zod';
import { env } from '../env';

Handlebars.registerHelper('upper', (s: string) => s.toUpperCase());

const titleTemplate = Handlebars.compile('[{{upper severity}}] {{summary}}');

const bodyTemplate = Handlebars.compile(
  `## Bug Report

**Severity:** {{severity}}
**Reporter:** {{reporter}}

### Description

{{details}}

{{#if steps}}
### Steps to Reproduce

{{#each steps}}
{{@index}}. {{this}}
{{/each}}
{{/if}}

{{#if environment}}
### Environment

\`{{environment}}\`
{{/if}}`,
);

const inputSchema = z.object({
  summary: z.string(),
  details: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  reporter: z.string(),
  steps: z.array(z.string()).optional(),
  environment: z.string().optional(),
});

const rpc = createNotify({
  channels: { github: githubChannel({ defaults: { repo: env.GITHUB_REPO } }) },
});
const catalog = rpc.catalog({
  bugReport: rpc
    .github()
    .issue()
    .input(inputSchema)
    .title(({ input }) => titleTemplate(input))
    .body(({ input }) => bodyTemplate(input)),
});

export const runGithubIssueHandlebars = async (): Promise<void> => {
  const transport = githubTransport({ token: env.GITHUB_TOKEN });

  const notify = createClient({
    catalog,
    transportsByChannel: { github: transport },
  });

  const result = await notify.bugReport.send({
    input: {
      summary: 'Login page 500 error',
      details: 'Users see a 500 error when trying to log in with SSO.',
      severity: 'critical',
      reporter: 'octocat',
      steps: [
        'Go to /login',
        'Click "Sign in with SSO"',
        'Enter valid credentials',
        'See 500 error page',
      ],
      environment: 'production / Chrome 126',
    },
    labels: ['bug', 'critical'],
    assignees: ['octocat'],
  });

  console.log('messageId:', result.messageId);
  console.log('— GitHub issue title and body rendered with Handlebars templates.');
};
