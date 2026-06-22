import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { githubChannel } from './channel.js';

const ch = githubChannel();

const issuePicker = () => ch.createBuilder({ ctx: undefined, rootMiddleware: [] });

describe('githubChannel', () => {
  it('has name "github"', () => {
    expect(ch.name).toBe('github');
  });

  describe('action picker', () => {
    it('issue() returns a builder with _channel="github"', () => {
      const b = issuePicker().issue();
      expect((b as unknown as { _channel: string })._channel).toBe('github');
    });

    it('issueComment() returns a builder with _channel="github"', () => {
      const b = issuePicker().issueComment();
      expect((b as unknown as { _channel: string })._channel).toBe('github');
    });

    it('prComment() returns a builder with _channel="github"', () => {
      const b = issuePicker().prComment();
      expect((b as unknown as { _channel: string })._channel).toBe('github');
    });

    it('prLineComment() returns a builder with _channel="github"', () => {
      const b = issuePicker().prLineComment();
      expect((b as unknown as { _channel: string })._channel).toBe('github');
    });

    it('prReview() returns a builder with _channel="github"', () => {
      const b = issuePicker().prReview();
      expect((b as unknown as { _channel: string })._channel).toBe('github');
    });
  });

  describe('issue builder', () => {
    it('renders issue with title and body from resolvers', async () => {
      const builder = issuePicker()
        .issue()
        .input(z.object({ summary: z.string() }))
        .title(({ input }) => `Bug: ${input.summary}`)
        .body(({ input }) => `Description: ${input.summary}`);
      const def = ch.finalize(builder, 'bug');
      const out = await ch.render(
        def,
        { input: { summary: 'Login broken' }, repo: 'org/repo', labels: ['bug'] },
        {},
      );
      expect(out).toEqual({
        action: 'issue',
        title: 'Bug: Login broken',
        body: 'Description: Login broken',
        repo: 'org/repo',
        labels: ['bug'],
      });
    });

    it('renders issue with static title and body', async () => {
      const builder = issuePicker()
        .issue()
        .input(z.object({ x: z.string() }))
        .title('Static Title')
        .body('Static Body');
      const def = ch.finalize(builder, 'static');
      const out = await ch.render(def, { input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'issue',
        title: 'Static Title',
        body: 'Static Body',
      });
    });

    it('renders issue with optional assignees and milestone', async () => {
      const builder = issuePicker()
        .issue()
        .input(z.object({ x: z.string() }))
        .title('T')
        .body('B');
      const def = ch.finalize(builder, 'full');
      const out = await ch.render(
        def,
        {
          input: { x: 'val' },
          repo: 'org/repo',
          assignees: ['user1'],
          milestone: 5,
        },
        {},
      );
      expect(out).toEqual({
        action: 'issue',
        title: 'T',
        body: 'B',
        repo: 'org/repo',
        assignees: ['user1'],
        milestone: 5,
      });
    });

    it('finalize throws when title is missing', () => {
      const builder = issuePicker()
        .issue()
        .input(z.object({ x: z.string() }))
        .body('B');
      expect(() => ch.finalize(builder, 'r')).toThrow(/missing required slot: title/);
    });

    it('finalize throws when body is missing', () => {
      const builder = issuePicker()
        .issue()
        .input(z.object({ x: z.string() }))
        .title('T');
      expect(() => ch.finalize(builder, 'r')).toThrow(/missing required slot: body/);
    });

    it('finalize succeeds when input is omitted (input slot is optional)', () => {
      const builder = issuePicker().issue().title('T').body('B');
      const def = ch.finalize(builder, 'r');
      expect(def.schema).toBeDefined();
    });
  });

  describe('issueComment builder', () => {
    it('renders issue comment with body', async () => {
      const builder = issuePicker()
        .issueComment()
        .input(z.object({ msg: z.string() }))
        .body(({ input }) => input.msg);
      const def = ch.finalize(builder, 'ack');
      const out = await ch.render(
        def,
        { input: { msg: 'Acknowledged' }, repo: 'org/repo', issueNumber: 42 },
        {},
      );
      expect(out).toEqual({
        action: 'comment',
        body: 'Acknowledged',
        repo: 'org/repo',
        issueNumber: 42,
      });
    });

    it('renders issue comment without optional repo', async () => {
      const builder = issuePicker()
        .issueComment()
        .input(z.object({ msg: z.string() }))
        .body('Static comment');
      const def = ch.finalize(builder, 'note');
      const out = await ch.render(def, { input: { msg: 'x' }, issueNumber: 10 }, {});
      expect(out).toEqual({
        action: 'comment',
        body: 'Static comment',
        issueNumber: 10,
      });
    });

    it('finalize throws when body is missing', () => {
      const builder = issuePicker()
        .issueComment()
        .input(z.object({ x: z.string() }));
      expect(() => ch.finalize(builder, 'r')).toThrow(/missing required slot: body/);
    });
  });

  describe('prComment builder', () => {
    it('renders with required fields', async () => {
      const builder = issuePicker()
        .prComment()
        .input(z.object({ msg: z.string() }))
        .body(({ input }) => input.msg);
      const def = ch.finalize(builder, 'pr-note');
      const out = await ch.render(
        def,
        {
          input: { msg: 'Nice work!' },
          repo: 'org/repo',
          prNumber: 42,
        },
        {},
      );
      expect(out).toEqual({
        action: 'pr-comment',
        body: 'Nice work!',
        repo: 'org/repo',
        prNumber: 42,
      });
    });

    it('uses default repo when not provided', async () => {
      const chWithDefaults = githubChannel({ defaults: { repo: 'default/repo' } });
      const builder = chWithDefaults
        .createBuilder({ ctx: undefined, rootMiddleware: [] })
        .prComment()
        .input(z.object({ x: z.string() }))
        .body('B');
      const def = chWithDefaults.finalize(builder, 'r');
      const out = await chWithDefaults.render(def, { input: { x: 'val' }, prNumber: 5 }, {});
      expect(out).toMatchObject({ action: 'pr-comment', repo: 'default/repo' });
    });

    it('overrides default repo with send arg', async () => {
      const chWithDefaults = githubChannel({ defaults: { repo: 'default/repo' } });
      const builder = chWithDefaults
        .createBuilder({ ctx: undefined, rootMiddleware: [] })
        .prComment()
        .input(z.object({ x: z.string() }))
        .body('B');
      const def = chWithDefaults.finalize(builder, 'r');
      const out = await chWithDefaults.render(
        def,
        {
          input: { x: 'val' },
          repo: 'override/repo',
          prNumber: 5,
        },
        {},
      );
      expect(out).toMatchObject({ action: 'pr-comment', repo: 'override/repo' });
    });

    it('finalize throws when body is missing', () => {
      const builder = issuePicker()
        .prComment()
        .input(z.object({ x: z.string() }));
      expect(() => ch.finalize(builder, 'r')).toThrow(/missing required slot: body/);
    });
  });

  describe('prLineComment builder', () => {
    it('renders with required fields', async () => {
      const builder = issuePicker()
        .prLineComment()
        .input(z.object({ msg: z.string() }))
        .body(({ input }) => input.msg);
      const def = ch.finalize(builder, 'pr-line-note');
      const out = await ch.render(
        def,
        {
          input: { msg: 'Needs fix' },
          repo: 'org/repo',
          prNumber: 42,
          commitId: 'abc123',
          path: 'src/index.ts',
        },
        {},
      );
      expect(out).toEqual({
        action: 'pr-line-comment',
        body: 'Needs fix',
        repo: 'org/repo',
        prNumber: 42,
        commitId: 'abc123',
        path: 'src/index.ts',
      });
    });

    it('renders with optional fields', async () => {
      const builder = issuePicker()
        .prLineComment()
        .input(z.object({ msg: z.string() }))
        .body(({ input }) => input.msg);
      const def = ch.finalize(builder, 'pr-line-note-full');
      const out = await ch.render(
        def,
        {
          input: { msg: 'Line comment' },
          repo: 'org/repo',
          prNumber: 42,
          commitId: 'abc123',
          path: 'src/index.ts',
          line: 10,
          startLine: 5,
          side: 'RIGHT',
          startSide: 'LEFT',
          subjectType: 'line',
        },
        {},
      );
      expect(out).toEqual({
        action: 'pr-line-comment',
        body: 'Line comment',
        repo: 'org/repo',
        prNumber: 42,
        commitId: 'abc123',
        path: 'src/index.ts',
        line: 10,
        startLine: 5,
        side: 'RIGHT',
        startSide: 'LEFT',
        subjectType: 'line',
      });
    });

    it('uses default repo when not provided', async () => {
      const chWithDefaults = githubChannel({ defaults: { repo: 'default/repo' } });
      const builder = chWithDefaults
        .createBuilder({ ctx: undefined, rootMiddleware: [] })
        .prLineComment()
        .input(z.object({ x: z.string() }))
        .body('B');
      const def = chWithDefaults.finalize(builder, 'r');
      const out = await chWithDefaults.render(
        def,
        { input: { x: 'val' }, prNumber: 5, commitId: 'sha1', path: 'file.ts' },
        {},
      );
      expect(out).toMatchObject({ action: 'pr-line-comment', repo: 'default/repo' });
    });

    it('overrides default repo with send arg', async () => {
      const chWithDefaults = githubChannel({ defaults: { repo: 'default/repo' } });
      const builder = chWithDefaults
        .createBuilder({ ctx: undefined, rootMiddleware: [] })
        .prLineComment()
        .input(z.object({ x: z.string() }))
        .body('B');
      const def = chWithDefaults.finalize(builder, 'r');
      const out = await chWithDefaults.render(
        def,
        {
          input: { x: 'val' },
          repo: 'override/repo',
          prNumber: 5,
          commitId: 'sha1',
          path: 'file.ts',
        },
        {},
      );
      expect(out).toMatchObject({ action: 'pr-line-comment', repo: 'override/repo' });
    });

    it('finalize throws when body is missing', () => {
      const builder = issuePicker()
        .prLineComment()
        .input(z.object({ x: z.string() }));
      expect(() => ch.finalize(builder, 'r')).toThrow(/missing required slot: body/);
    });
  });

  describe('prReview builder', () => {
    it('renders pr review with body and event', async () => {
      const builder = issuePicker()
        .prReview()
        .input(z.object({ notes: z.string() }))
        .body(({ input }) => input.notes);
      const def = ch.finalize(builder, 'review');
      const out = await ch.render(
        def,
        {
          input: { notes: 'LGTM' },
          repo: 'org/repo',
          prNumber: 123,
          event: 'APPROVE',
        },
        {},
      );
      expect(out).toEqual({
        action: 'pr-review',
        body: 'LGTM',
        repo: 'org/repo',
        prNumber: 123,
        event: 'APPROVE',
      });
    });

    it('renders pr review without optional repo', async () => {
      const builder = issuePicker()
        .prReview()
        .input(z.object({ x: z.string() }))
        .body('Needs changes');
      const def = ch.finalize(builder, 'reject');
      const out = await ch.render(
        def,
        { input: { x: 'val' }, prNumber: 99, event: 'REQUEST_CHANGES' },
        {},
      );
      expect(out).toEqual({
        action: 'pr-review',
        body: 'Needs changes',
        prNumber: 99,
        event: 'REQUEST_CHANGES',
      });
    });

    it('finalize throws when body is missing', () => {
      const builder = issuePicker()
        .prReview()
        .input(z.object({ x: z.string() }));
      expect(() => ch.finalize(builder, 'r')).toThrow(/missing required slot: body/);
    });
  });

  describe('validateArgs', () => {
    it('accepts issue args', async () => {
      const result = await ch.validateArgs({
        input: { x: 1 },
        repo: 'org/repo',
        labels: ['bug'],
      });
      expect(result).toMatchObject({ repo: 'org/repo', labels: ['bug'] });
    });

    it('accepts issue comment args', async () => {
      const result = await ch.validateArgs({
        input: { x: 1 },
        repo: 'org/repo',
        issueNumber: 42,
      });
      expect(result).toMatchObject({ repo: 'org/repo', issueNumber: 42 });
    });

    it('accepts pr comment args', async () => {
      const result = await ch.validateArgs({
        input: { x: 1 },
        repo: 'org/repo',
        prNumber: 42,
      });
      expect(result).toMatchObject({
        repo: 'org/repo',
        prNumber: 42,
      });
    });

    it('accepts pr line comment args', async () => {
      const result = await ch.validateArgs({
        input: { x: 1 },
        repo: 'org/repo',
        prNumber: 42,
        commitId: 'abc123',
        path: 'src/index.ts',
        startLine: 5,
        startSide: 'LEFT',
      });
      expect(result).toMatchObject({
        repo: 'org/repo',
        prNumber: 42,
        commitId: 'abc123',
        path: 'src/index.ts',
        startLine: 5,
        startSide: 'LEFT',
      });
    });

    it('accepts pr review args', async () => {
      const result = await ch.validateArgs({
        input: { x: 1 },
        repo: 'org/repo',
        prNumber: 123,
        event: 'APPROVE',
      });
      expect(result).toMatchObject({ repo: 'org/repo', prNumber: 123, event: 'APPROVE' });
    });

    it('accepts minimal args', async () => {
      const result = await ch.validateArgs({ input: {} });
      expect(result).toMatchObject({ input: {} });
    });

    it('rejects null args', () => {
      expect(() => ch.validateArgs(null)).toThrow();
    });
  });

  describe('defaults.repo', () => {
    it('renders issue with default repo when send args omit repo', async () => {
      const chWithDefaults = githubChannel({ defaults: { repo: 'default/repo' } });
      const builder = chWithDefaults
        .createBuilder({ ctx: undefined, rootMiddleware: [] })
        .issue()
        .input(z.object({ x: z.string() }))
        .title('T')
        .body('B');
      const def = chWithDefaults.finalize(builder, 'r');
      const out = await chWithDefaults.render(def, { input: { x: 'val' } }, {});
      expect(out).toMatchObject({ action: 'issue', repo: 'default/repo' });
    });

    it('send-time repo overrides defaults.repo', async () => {
      const chWithDefaults = githubChannel({ defaults: { repo: 'default/repo' } });
      const builder = chWithDefaults
        .createBuilder({ ctx: undefined, rootMiddleware: [] })
        .issue()
        .input(z.object({ x: z.string() }))
        .title('T')
        .body('B');
      const def = chWithDefaults.finalize(builder, 'r');
      const out = await chWithDefaults.render(
        def,
        { input: { x: 'val' }, repo: 'override/repo' },
        {},
      );
      expect(out).toMatchObject({ action: 'issue', repo: 'override/repo' });
    });

    it('defaults.repo applies to issueComment action', async () => {
      const chWithDefaults = githubChannel({ defaults: { repo: 'default/repo' } });
      const builder = chWithDefaults
        .createBuilder({ ctx: undefined, rootMiddleware: [] })
        .issueComment()
        .input(z.object({ x: z.string() }))
        .body('B');
      const def = chWithDefaults.finalize(builder, 'r');
      const out = await chWithDefaults.render(def, { input: { x: 'val' }, issueNumber: 1 }, {});
      expect(out).toMatchObject({ action: 'comment', repo: 'default/repo' });
    });

    it('defaults.repo applies to prComment action', async () => {
      const chWithDefaults = githubChannel({ defaults: { repo: 'default/repo' } });
      const builder = chWithDefaults
        .createBuilder({ ctx: undefined, rootMiddleware: [] })
        .prComment()
        .input(z.object({ x: z.string() }))
        .body('B');
      const def = chWithDefaults.finalize(builder, 'r');
      const out = await chWithDefaults.render(def, { input: { x: 'val' }, prNumber: 1 }, {});
      expect(out).toMatchObject({ action: 'pr-comment', repo: 'default/repo' });
    });

    it('defaults.repo applies to prLineComment action', async () => {
      const chWithDefaults = githubChannel({ defaults: { repo: 'default/repo' } });
      const builder = chWithDefaults
        .createBuilder({ ctx: undefined, rootMiddleware: [] })
        .prLineComment()
        .input(z.object({ x: z.string() }))
        .body('B');
      const def = chWithDefaults.finalize(builder, 'r');
      const out = await chWithDefaults.render(
        def,
        { input: { x: 'val' }, prNumber: 1, commitId: 'sha1', path: 'file.ts' },
        {},
      );
      expect(out).toMatchObject({ action: 'pr-line-comment', repo: 'default/repo' });
    });

    it('defaults.repo applies to prReview action', async () => {
      const chWithDefaults = githubChannel({ defaults: { repo: 'default/repo' } });
      const builder = chWithDefaults
        .createBuilder({ ctx: undefined, rootMiddleware: [] })
        .prReview()
        .input(z.object({ x: z.string() }))
        .body('B');
      const def = chWithDefaults.finalize(builder, 'r');
      const out = await chWithDefaults.render(
        def,
        { input: { x: 'val' }, prNumber: 1, event: 'APPROVE' },
        {},
      );
      expect(out).toMatchObject({ action: 'pr-review', repo: 'default/repo' });
    });

    it('omits repo when no default and no send-time repo', async () => {
      const builder = issuePicker()
        .issue()
        .input(z.object({ x: z.string() }))
        .title('T')
        .body('B');
      const def = ch.finalize(builder, 'r');
      const out = await ch.render(def, { input: { x: 'val' } }, {});
      expect(out).toEqual({ action: 'issue', title: 'T', body: 'B' });
    });
  });

  describe('middleware seeding', () => {
    it('seeds rootMiddleware into issue builder', () => {
      const mw = async () => undefined as never;
      const picker = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
      const b = picker.issue();
      expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toContain(
        mw,
      );
    });

    it('seeds rootMiddleware into issueComment builder', () => {
      const mw = async () => undefined as never;
      const picker = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
      const b = picker.issueComment();
      expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toContain(
        mw,
      );
    });

    it('seeds rootMiddleware into prComment builder', () => {
      const mw = async () => undefined as never;
      const picker = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
      const b = picker.prComment();
      expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toContain(
        mw,
      );
    });

    it('seeds rootMiddleware into prLineComment builder', () => {
      const mw = async () => undefined as never;
      const picker = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
      const b = picker.prLineComment();
      expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toContain(
        mw,
      );
    });

    it('seeds rootMiddleware into prReview builder', () => {
      const mw = async () => undefined as never;
      const picker = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
      const b = picker.prReview();
      expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toContain(
        mw,
      );
    });
  });
});
