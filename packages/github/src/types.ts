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

export type RenderedGithubComment = {
  action: 'comment';
  body: string;
  repo?: string;
  issueNumber: number;
};

export type RenderedGithubPrReview = {
  action: 'pr-review';
  body: string;
  repo?: string;
  prNumber: number;
  event: GithubReviewEvent;
};

export type RenderedGithub = RenderedGithubIssue | RenderedGithubComment | RenderedGithubPrReview;

export type GithubIssueSendArgs<TInput = unknown> = {
  repo?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
  input: TInput;
};

export type GithubCommentSendArgs<TInput = unknown> = {
  repo?: string;
  issueNumber: number;
  input: TInput;
};

export type GithubPrReviewSendArgs<TInput = unknown> = {
  repo?: string;
  prNumber: number;
  event: GithubReviewEvent;
  input: TInput;
};

export type GithubAction = 'issue' | 'comment' | 'pr-review';
