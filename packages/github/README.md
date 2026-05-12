# @betternotify/github

[GitHub](https://github.com) channel for [Better-Notify](https://github.com/better-notify/better-notify). Creates issues, posts comments, and submits PR reviews through the GitHub REST API using a single channel with discriminated builder actions.

<p>
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

## Install

```sh
npm install @betternotify/github @betternotify/core
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { githubChannel, githubTransport } from '@betternotify/github';
import { z } from 'zod';

const github = githubChannel({
  defaults: { repo: 'org/repo' },
});

const rpc = createNotify({ channels: { github } });

const catalog = rpc.catalog({
  bugReport: rpc
    .github()
    .issue()
    .input(z.object({ summary: z.string(), details: z.string() }))
    .title(({ input }) => `Bug: ${input.summary}`)
    .body(({ input }) => input.details),

  reviewAck: rpc
    .github()
    .comment()
    .input(z.object({ message: z.string() }))
    .body(({ input }) => input.message),

  releaseApproval: rpc
    .github()
    .prReview()
    .input(z.object({ notes: z.string() }))
    .body(({ input }) => input.notes),
});

const notify = createClient({
  catalog,
  channels: { github },
  transportsByChannel: {
    github: githubTransport({ token: process.env.GITHUB_TOKEN! }),
  },
});
```

### Sending

```ts
// Create an issue
await notify.bugReport.send({
  input: { summary: 'Login broken', details: 'SSO returns 500.' },
  labels: ['bug', 'critical'],
  assignees: ['octocat'],
});

// Comment on an issue or PR
await notify.reviewAck.send({
  input: { message: 'Looking into this.' },
  issueNumber: 42,
});

// Submit a PR review
await notify.releaseApproval.send({
  input: { notes: 'LGTM, ship it.' },
  prNumber: 123,
  event: 'APPROVE',
});
```

## Actions

`githubChannel()` exposes three actions via the builder. Each narrows the available slots and send-time args.

### `.issue()`

Creates a GitHub issue.

**Slots:** `title` (required), `body` (required)

**Send args:**

| Field       | Type       | Required | Description                                             |
| ----------- | ---------- | -------- | ------------------------------------------------------- |
| `repo`      | `string`   | No       | `owner/repo` — falls back to `defaults.repo` on channel options |
| `labels`    | `string[]` | No       | Labels to apply                                         |
| `assignees` | `string[]` | No       | GitHub usernames to assign                              |
| `milestone` | `number`   | No       | Milestone number (not title)                            |

### `.comment()`

Posts a comment on an issue or pull request.

**Slots:** `body` (required)

**Send args:**

| Field         | Type     | Required | Description                 |
| ------------- | -------- | -------- | --------------------------- |
| `repo`        | `string` | No       | Falls back to `defaults.repo` |
| `issueNumber` | `number` | Yes      | Issue or PR number          |

### `.prReview()`

Submits a pull request review.

**Slots:** `body` (required)

**Send args:**

| Field      | Type     | Required | Description                                      |
| ---------- | -------- | -------- | ------------------------------------------------ |
| `repo`     | `string` | No       | Falls back to `defaults.repo`                    |
| `prNumber` | `number` | Yes      | PR number                                        |
| `event`    | `string` | Yes      | `'APPROVE'`, `'REQUEST_CHANGES'`, or `'COMMENT'` |

## Channel Options

| Field           | Type     | Description                                                      |
| --------------- | -------- | ---------------------------------------------------------------- |
| `defaults.repo` | `string` | Default `owner/repo` used when `repo` is omitted from send args. |

## Transport Options

| Field     | Type     | Description                                                      |
| --------- | -------- | ---------------------------------------------------------------- |
| `token`   | `string` | GitHub personal access token or fine-grained token. Required.    |
| `baseUrl` | `string` | Override the API base URL. Defaults to `https://api.github.com`. |
| `logger`  | `object` | Optional `LoggerLike`. Defaults to `consoleLogger()`.            |
| `http`    | `object` | HTTP behavior options (retry, timeout, hooks).                   |

## Endpoints

| Action      | GitHub API                                            |
| ----------- | ----------------------------------------------------- |
| `issue`     | `POST /repos/{owner}/{repo}/issues`                   |
| `comment`   | `POST /repos/{owner}/{repo}/issues/{number}/comments` |
| `pr-review` | `POST /repos/{owner}/{repo}/pulls/{number}/reviews`   |

## License

MIT
