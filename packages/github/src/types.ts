export type GithubReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

export type RenderedGithubIssue = {
  action: 'issue';
  title: string;
  body: string;
  repo?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
};

export type RenderedGithubIssueComment = {
  action: 'comment';
  body: string;
  repo?: string;
  issueNumber: number;
};

export type RenderedGithubPrComment = {
  action: 'pr-comment';
  body: string;
  repo?: string;
  prNumber: number;
};

export type RenderedGithubPrLineComment = {
  action: 'pr-line-comment';
  body: string;
  repo?: string;
  prNumber: number;
  commitId: string;
  path: string;
  line?: number;
  startLine?: number;
  side?: 'LEFT' | 'RIGHT';
  startSide?: 'LEFT' | 'RIGHT';
  subjectType?: 'line' | 'file';
};

export type RenderedGithubPrReview = {
  action: 'pr-review';
  body: string;
  repo?: string;
  prNumber: number;
  event: GithubReviewEvent;
};

export type RenderedGithub =
  | RenderedGithubIssue
  | RenderedGithubIssueComment
  | RenderedGithubPrComment
  | RenderedGithubPrLineComment
  | RenderedGithubPrReview;

export type GithubIssueSendArgs<TInput = unknown> = {
  repo?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
  input: TInput;
};

export type GithubIssueCommentSendArgs<TInput = unknown> = {
  repo?: string;
  issueNumber: number;
  input: TInput;
};

export type GithubPrCommentSendArgs<TInput = unknown> = {
  repo?: string;
  prNumber: number;
  input: TInput;
};

export type GithubPrLineCommentSendArgs<TInput = unknown> = {
  repo?: string;
  prNumber: number;
  commitId: string;
  path: string;
  line?: number;
  startLine?: number;
  side?: 'LEFT' | 'RIGHT';
  startSide?: 'LEFT' | 'RIGHT';
  subjectType?: 'line' | 'file';
  input: TInput;
};

export type GithubPrReviewSendArgs<TInput = unknown> = {
  repo?: string;
  prNumber: number;
  event: GithubReviewEvent;
  input: TInput;
};

export type GithubAction = 'issue' | 'comment' | 'pr-comment' | 'pr-line-comment' | 'pr-review';
