import type { Transport as CoreTransport } from '@betternotify/core';
import type { RenderedGithub } from '../types.js';

export type GithubIssueData = {
  action: 'issue';
  number: number;
  url: string;
};

export type GithubIssueCommentData = {
  action: 'comment';
  id: number;
  url: string;
};

export type GithubPrCommentData = {
  action: 'pr-comment';
  id: number;
  url: string;
};

export type GithubPrLineCommentData = {
  action: 'pr-line-comment';
  id: number;
  url: string;
};

export type GithubPrReviewData = {
  action: 'pr-review';
  id: number;
  url: string;
};

export type GithubTransportData =
  | GithubIssueData
  | GithubIssueCommentData
  | GithubPrCommentData
  | GithubPrLineCommentData
  | GithubPrReviewData;

export type GithubTransportResult = GithubTransportData;

export type Transport = CoreTransport<RenderedGithub, GithubTransportData>;
