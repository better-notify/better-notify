import { z } from 'zod';

export const issueArgsSchema = z.object({
  repo: z.string().optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  milestone: z.number().optional(),
  input: z.unknown(),
});

export const issueCommentArgsSchema = z.object({
  repo: z.string().optional(),
  issueNumber: z.number(),
  input: z.unknown(),
});

export const prCommentArgsSchema = z.object({
  repo: z.string().optional(),
  prNumber: z.number(),
  input: z.unknown(),
});

export const prLineCommentArgsSchema = z.object({
  repo: z.string().optional(),
  prNumber: z.number(),
  commitId: z.string(),
  path: z.string(),
  line: z.number().optional(),
  startLine: z.number().optional(),
  side: z.enum(['LEFT', 'RIGHT']).optional(),
  startSide: z.enum(['LEFT', 'RIGHT']).optional(),
  subjectType: z.enum(['line', 'file']).optional(),
  input: z.unknown(),
});

export const prReviewArgsSchema = z.object({
  repo: z.string().optional(),
  prNumber: z.number(),
  event: z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']),
  input: z.unknown(),
});

export const permissiveArgsSchema = z
  .object({
    repo: z.string().optional(),
    labels: z.array(z.string()).optional(),
    assignees: z.array(z.string()).optional(),
    milestone: z.number().optional(),
    issueNumber: z.number().optional(),
    prNumber: z.number().optional(),
    event: z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']).optional(),
    commitId: z.string().optional(),
    path: z.string().optional(),
    line: z.number().optional(),
    startLine: z.number().optional(),
    side: z.enum(['LEFT', 'RIGHT']).optional(),
    startSide: z.enum(['LEFT', 'RIGHT']).optional(),
    subjectType: z.enum(['line', 'file']).optional(),
    input: z.unknown(),
  })
  .loose();
