import { defineChannel, slot } from '@betternotify/core';
import type { ChannelBuilderCtx, ChannelDefinition, Channel } from '@betternotify/core';
import type { Transport } from '@betternotify/core';
import { z } from 'zod';
import type {
  RenderedGithub,
  RenderedGithubIssue,
  RenderedGithubComment,
  RenderedGithubPrReview,
  GithubAction,
} from './types.js';

export type TitleResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);

export type BodyResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);

export type GithubChannelOptions = {
  defaults?: {
    repo?: string;
  };
};

const issueArgsSchema = z.object({
  repo: z.string().optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  milestone: z.number().optional(),
  input: z.unknown(),
});

const commentArgsSchema = z.object({
  repo: z.string().optional(),
  issueNumber: z.number(),
  input: z.unknown(),
});

const prReviewArgsSchema = z.object({
  repo: z.string().optional(),
  prNumber: z.number(),
  event: z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']),
  input: z.unknown(),
});

const permissiveArgsSchema = z
  .object({
    repo: z.string().optional(),
    labels: z.array(z.string()).optional(),
    assignees: z.array(z.string()).optional(),
    milestone: z.number().optional(),
    issueNumber: z.number().optional(),
    prNumber: z.number().optional(),
    event: z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']).optional(),
    input: z.unknown(),
  })
  .passthrough();

const createInternalChannels = (options: GithubChannelOptions) => {
  const defaultRepo = options.defaults?.repo;

  const issue = defineChannel({
    name: 'github' as const,
    slots: {
      _action: slot.value<'issue'>(),
      title: slot.resolver<string>(),
      body: slot.resolver<string>(),
    },
    validateArgs: issueArgsSchema,
    render: ({ runtime, args }): RenderedGithubIssue => {
      const repo = args.repo ?? defaultRepo;
      const result: RenderedGithubIssue = {
        action: 'issue',
        title: runtime.title,
        body: runtime.body,
      };
      if (repo !== undefined) result.repo = repo;
      if (args.labels !== undefined) result.labels = args.labels;
      if (args.assignees !== undefined) result.assignees = args.assignees;
      if (args.milestone !== undefined) result.milestone = args.milestone;
      return result;
    },
  });

  const comment = defineChannel({
    name: 'github' as const,
    slots: {
      _action: slot.value<'comment'>(),
      body: slot.resolver<string>(),
    },
    validateArgs: commentArgsSchema,
    render: ({ runtime, args }): RenderedGithubComment => {
      const repo = args.repo ?? defaultRepo;
      const result: RenderedGithubComment = {
        action: 'comment',
        body: runtime.body,
        issueNumber: args.issueNumber,
      };
      if (repo !== undefined) result.repo = repo;
      return result;
    },
  });

  const prReview = defineChannel({
    name: 'github' as const,
    slots: {
      _action: slot.value<'pr-review'>(),
      body: slot.resolver<string>(),
    },
    validateArgs: prReviewArgsSchema,
    render: ({ runtime, args }): RenderedGithubPrReview => {
      const repo = args.repo ?? defaultRepo;
      const result: RenderedGithubPrReview = {
        action: 'pr-review',
        body: runtime.body,
        prNumber: args.prNumber,
        event: args.event,
      };
      if (repo !== undefined) result.repo = repo;
      return result;
    },
  });

  return { issue, comment, 'pr-review': prReview };
};

type InternalChannels = ReturnType<typeof createInternalChannels>;
type IssueBuilder = ReturnType<InternalChannels['issue']['createBuilder']>;
type CommentBuilder = ReturnType<InternalChannels['comment']['createBuilder']>;
type PrReviewBuilder = ReturnType<InternalChannels['pr-review']['createBuilder']>;

type PublicBuilder<B> = Omit<B, '_action' | '_args' | '_rendered' | '_state'>;

export type GithubActionPicker = {
  issue(): PublicBuilder<IssueBuilder>;
  comment(): PublicBuilder<CommentBuilder>;
  prReview(): PublicBuilder<PrReviewBuilder>;
};

export type GithubChannel = Channel<
  'github',
  GithubActionPicker,
  unknown,
  RenderedGithub,
  Transport<RenderedGithub, unknown>
>;

export const githubChannel = (options: GithubChannelOptions = {}): GithubChannel => {
  const channels = createInternalChannels(options);

  return {
    name: 'github' as const,

    createBuilder: (ctx: ChannelBuilderCtx): GithubActionPicker => ({
      issue: () => {
        const builder = channels.issue.createBuilder(ctx);
        return builder._action('issue' as never) as PublicBuilder<IssueBuilder>;
      },
      comment: () => {
        const builder = channels.comment.createBuilder(ctx);
        return builder._action('comment' as never) as PublicBuilder<CommentBuilder>;
      },
      prReview: () => {
        const builder = channels['pr-review'].createBuilder(ctx);
        return builder._action('pr-review' as never) as PublicBuilder<PrReviewBuilder>;
      },
    }),

    validateArgs: (rawArgs: unknown) => permissiveArgsSchema.parse(rawArgs),

    render: async (
      def: ChannelDefinition<unknown, RenderedGithub>,
      args: unknown,
      ctx: unknown,
    ): Promise<RenderedGithub> => {
      const runtime = def.runtime as { _action: GithubAction };
      const channel = channels[runtime._action];
      return channel.render(def as never, args as never, ctx);
    },

    finalize: (state: unknown, id: string) =>
      (
        state as { _finalize: (id: string) => ChannelDefinition<unknown, RenderedGithub> }
      )._finalize(id),

    previewRender: undefined,
    _transport: undefined as never,
  };
};
