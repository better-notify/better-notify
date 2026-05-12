import { defineChannel, slot } from '@betternotify/core';
import type { ChannelBuilderCtx, ChannelDefinition, Channel } from '@betternotify/core';
import type { Transport } from '@betternotify/core';
import type {
  RenderedGithub,
  RenderedGithubIssue,
  RenderedGithubIssueComment,
  RenderedGithubPrComment,
  RenderedGithubPrLineComment,
  RenderedGithubPrReview,
  GithubAction,
} from './types.js';
import {
  issueArgsSchema,
  issueCommentArgsSchema,
  prCommentArgsSchema,
  prLineCommentArgsSchema,
  prReviewArgsSchema,
  permissiveArgsSchema,
} from './channel.schemas.js';

export type TitleResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);

export type BodyResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);

export type GithubChannelOptions = {
  defaults?: {
    repo?: string;
  };
};

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
    validateArgs: issueCommentArgsSchema,
    render: ({ runtime, args }): RenderedGithubIssueComment => {
      const repo = args.repo ?? defaultRepo;

      const result: RenderedGithubIssueComment = {
        action: 'comment',
        body: runtime.body,
        issueNumber: args.issueNumber,
      };

      if (repo !== undefined) result.repo = repo;
      return result;
    },
  });

  const prComment = defineChannel({
    name: 'github' as const,
    slots: {
      _action: slot.value<'pr-comment'>(),
      body: slot.resolver<string>(),
    },
    validateArgs: prCommentArgsSchema,
    render: ({ runtime, args }): RenderedGithubPrComment => {
      const repo = args.repo ?? defaultRepo;
      const result: RenderedGithubPrComment = {
        action: 'pr-comment',
        body: runtime.body,
        prNumber: args.prNumber,
      };
      if (repo !== undefined) result.repo = repo;
      return result;
    },
  });

  const prLineComment = defineChannel({
    name: 'github' as const,
    slots: {
      _action: slot.value<'pr-line-comment'>(),
      body: slot.resolver<string>(),
    },
    validateArgs: prLineCommentArgsSchema,
    render: ({ runtime, args }): RenderedGithubPrLineComment => {
      const repo = args.repo ?? defaultRepo;
      const result: RenderedGithubPrLineComment = {
        action: 'pr-line-comment',
        body: runtime.body,
        prNumber: args.prNumber,
        commitId: args.commitId,
        path: args.path,
      };
      if (repo !== undefined) result.repo = repo;
      if (args.line !== undefined) result.line = args.line;
      if (args.startLine !== undefined) result.startLine = args.startLine;
      if (args.side !== undefined) result.side = args.side;
      if (args.startSide !== undefined) result.startSide = args.startSide;
      if (args.subjectType !== undefined) result.subjectType = args.subjectType;
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

  return {
    issue,
    comment,
    'pr-comment': prComment,
    'pr-line-comment': prLineComment,
    'pr-review': prReview,
  };
};

type InternalChannels = ReturnType<typeof createInternalChannels>;
type IssueBuilder = ReturnType<InternalChannels['issue']['createBuilder']>;
type IssueCommentBuilder = ReturnType<InternalChannels['comment']['createBuilder']>;
type PrCommentBuilder = ReturnType<InternalChannels['pr-comment']['createBuilder']>;
type PrLineCommentBuilder = ReturnType<InternalChannels['pr-line-comment']['createBuilder']>;
type PrReviewBuilder = ReturnType<InternalChannels['pr-review']['createBuilder']>;

type PublicBuilder<B> = Omit<B, '_action' | '_args' | '_rendered' | '_state'>;

export type GithubActionPicker = {
  issue(): PublicBuilder<IssueBuilder>;
  issueComment(): PublicBuilder<IssueCommentBuilder>;
  prComment(): PublicBuilder<PrCommentBuilder>;
  prLineComment(): PublicBuilder<PrLineCommentBuilder>;
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
      issueComment: () => {
        const builder = channels.comment.createBuilder(ctx);
        return builder._action('comment' as never) as PublicBuilder<IssueCommentBuilder>;
      },
      prComment: () => {
        const builder = channels['pr-comment'].createBuilder(ctx);
        return builder._action('pr-comment' as never) as PublicBuilder<PrCommentBuilder>;
      },
      prLineComment: () => {
        const builder = channels['pr-line-comment'].createBuilder(ctx);
        return builder._action('pr-line-comment' as never) as PublicBuilder<PrLineCommentBuilder>;
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
