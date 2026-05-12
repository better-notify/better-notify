import type { Transport as CoreTransport } from '@betternotify/core';
import type { RenderedGithub } from '../types.js';

export type GithubIssueData = {
  action: 'issue';
  number: number;
  url: string;
};

export type GithubCommentData = {
  action: 'comment';
  id: number;
  url: string;
};

export type GithubPrReviewData = {
  action: 'pr-review';
  id: number;
  url: string;
};

export type GithubTransportData = GithubIssueData | GithubCommentData | GithubPrReviewData;

export type GithubTransportResult = GithubTransportData;

export type Transport = CoreTransport<RenderedGithub, GithubTransportData>;
