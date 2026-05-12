import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createNotify, createClient } from '@betternotify/core';
import { githubChannel, mockGithubTransport } from './index.js';

describe('github channel end-to-end', () => {
  it('sends an issue through createNotify + createClient + mockGithubTransport', async () => {
    const rpc = createNotify({
      channels: { github: githubChannel({ defaults: { repo: 'org/repo' } }) },
    });

    const catalog = rpc.catalog({
      bugReport: rpc
        .github()
        .issue()
        .input(z.object({ summary: z.string() }))
        .title(({ input }) => `Bug: ${input.summary}`)
        .body(({ input }) => `Description: ${input.summary}`),
    });

    const transport = mockGithubTransport();
    const client = createClient({
      catalog,
      channels: { github: githubChannel({ defaults: { repo: 'org/repo' } }) },
      transportsByChannel: { github: transport },
    });

    const result = await client.bugReport.send({
      input: { summary: 'Login broken' },
      labels: ['bug'],
    });

    expect(typeof result.messageId).toBe('string');
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]).toMatchObject({
      action: 'issue',
      title: 'Bug: Login broken',
      body: 'Description: Login broken',
      repo: 'org/repo',
      labels: ['bug'],
    });
  });

  it('sends a comment through the pipeline', async () => {
    const rpc = createNotify({
      channels: { github: githubChannel({ defaults: { repo: 'org/repo' } }) },
    });

    const catalog = rpc.catalog({
      ack: rpc
        .github()
        .comment()
        .input(z.object({ msg: z.string() }))
        .body(({ input }) => input.msg),
    });

    const transport = mockGithubTransport();
    const client = createClient({
      catalog,
      channels: { github: githubChannel({ defaults: { repo: 'org/repo' } }) },
      transportsByChannel: { github: transport },
    });

    await client.ack.send({
      input: { msg: 'Acknowledged' },
      issueNumber: 42,
    });

    expect(transport.messages[0]).toMatchObject({
      action: 'comment',
      body: 'Acknowledged',
      repo: 'org/repo',
      issueNumber: 42,
    });
  });

  it('sends a PR review through the pipeline', async () => {
    const rpc = createNotify({
      channels: { github: githubChannel({ defaults: { repo: 'org/repo' } }) },
    });

    const catalog = rpc.catalog({
      approve: rpc
        .github()
        .prReview()
        .input(z.object({ notes: z.string() }))
        .body(({ input }) => input.notes),
    });

    const transport = mockGithubTransport();
    const client = createClient({
      catalog,
      channels: { github: githubChannel({ defaults: { repo: 'org/repo' } }) },
      transportsByChannel: { github: transport },
    });

    await client.approve.send({
      input: { notes: 'LGTM' },
      prNumber: 123,
      event: 'APPROVE',
    });

    expect(transport.messages[0]).toMatchObject({
      action: 'pr-review',
      body: 'LGTM',
      repo: 'org/repo',
      prNumber: 123,
      event: 'APPROVE',
    });
  });

  it('batch sends multiple issues', async () => {
    const rpc = createNotify({
      channels: { github: githubChannel({ defaults: { repo: 'org/repo' } }) },
    });

    const catalog = rpc.catalog({
      bug: rpc
        .github()
        .issue()
        .input(z.object({ title: z.string() }))
        .title(({ input }) => input.title)
        .body('Auto-created'),
    });

    const transport = mockGithubTransport();
    const client = createClient({
      catalog,
      channels: { github: githubChannel({ defaults: { repo: 'org/repo' } }) },
      transportsByChannel: { github: transport },
    });

    const result = await client.bug.batch([
      { input: { title: 'Bug 1' } },
      { input: { title: 'Bug 2' } },
    ]);

    expect(result.okCount).toBe(2);
    expect(transport.messages.map((m) => (m as { title?: string }).title)).toEqual([
      'Bug 1',
      'Bug 2',
    ]);
  });

  it('supports multiple action types in the same catalog', async () => {
    const rpc = createNotify({
      channels: { github: githubChannel({ defaults: { repo: 'org/repo' } }) },
    });

    const catalog = rpc.catalog({
      bug: rpc
        .github()
        .issue()
        .input(z.object({ t: z.string() }))
        .title(({ input }) => input.t)
        .body('bug body'),
      note: rpc
        .github()
        .comment()
        .input(z.object({ m: z.string() }))
        .body(({ input }) => input.m),
      review: rpc
        .github()
        .prReview()
        .input(z.object({ n: z.string() }))
        .body(({ input }) => input.n),
    });

    const transport = mockGithubTransport();
    const client = createClient({
      catalog,
      channels: { github: githubChannel({ defaults: { repo: 'org/repo' } }) },
      transportsByChannel: { github: transport },
    });

    await client.bug.send({ input: { t: 'Issue' } });
    await client.note.send({ input: { m: 'Comment' }, issueNumber: 1 });
    await client.review.send({
      input: { n: 'Review' },
      prNumber: 2,
      event: 'COMMENT',
    });

    expect(transport.messages).toHaveLength(3);
    expect(transport.messages[0]).toMatchObject({ action: 'issue', title: 'Issue' });
    expect(transport.messages[1]).toMatchObject({ action: 'comment', body: 'Comment' });
    expect(transport.messages[2]).toMatchObject({ action: 'pr-review', body: 'Review' });
  });

  it('applies middleware from route-level .use()', async () => {
    const rpc = createNotify({
      channels: { github: githubChannel({ defaults: { repo: 'org/repo' } }) },
    });

    let middlewareCalled = false;
    const catalog = rpc.catalog({
      bug: rpc
        .github()
        .issue()
        .use(async ({ next }) => {
          middlewareCalled = true;
          return next();
        })
        .input(z.object({ t: z.string() }))
        .title('T')
        .body('B'),
    });

    const transport = mockGithubTransport();
    const client = createClient({
      catalog,
      channels: { github: githubChannel({ defaults: { repo: 'org/repo' } }) },
      transportsByChannel: { github: transport },
    });

    await client.bug.send({ input: { t: 'x' } });
    expect(middlewareCalled).toBe(true);
  });
});
