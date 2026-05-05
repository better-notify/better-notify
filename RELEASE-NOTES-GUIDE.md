# Writing Release Notes

After each release, write a curated summary. The auto-generated changelogs from release-please are commit-level and per-package — useful as a reference, but too granular for users. Release notes tell the story: what changed, why it matters, and what to do about it.

A human or an AI agent can write these.

---

## Gather the raw material

Collect everything that went into the release.

```sh
# 1. See which packages were released and their new versions
cat .release-please-manifest.json

# 2. Read the auto-generated changelog entries for a specific package
cat packages/core/CHANGELOG.md

# 3. See all commits since the last release tag
git log --oneline @betternotify/core-v0.0.2-alpha.0..@betternotify/core-v0.0.3-alpha.0

# 4. Get the full diff between releases
git diff @betternotify/core-v0.0.2-alpha.0..@betternotify/core-v0.0.3-alpha.0

# 5. List merged PRs in a date range (adjust dates)
gh pr list --state merged --search "merged:>2026-04-01" --json number,title,labels
```

## Release notes structure

````markdown
# Better-Notify v0.0.X-alpha.0

One or two sentences on the theme of this release.

## Highlights

- **Feature name** — what it does and why it matters. ([#PR](link))
- **Another feature** — brief explanation. ([#PR](link))

## Breaking changes

- `functionName` was renamed to `newName`. Update your imports:
  ```diff
  - import { functionName } from '@betternotify/core'
  + import { newName } from '@betternotify/core'
  ```
````

## Bug fixes

- Fixed edge case in X when Y. ([#PR](link))

## Packages released

| Package            | Version       |
| ------------------ | ------------- |
| @betternotify/core | 0.0.X-alpha.0 |
| ...                | ...           |

## Upgrade

\`\`\`sh
pnpm add @betternotify/core@alpha
\`\`\`

`````

### Guidelines

- **Lead with value, not commits.** Group related commits into a single bullet that explains the user-facing change.
- **One bullet per feature, not per commit.** A feature that took 5 commits gets one bullet.
- **Breaking changes get migration snippets.** Show a diff of what to change.
- **Skip internal-only changes.** Omit CI tweaks, internal refactors, and test improvements — include only changes that affect users.
- **Link PRs.** Every highlight links to its PR.

---

## Using an AI agent

Paste the following prompt into Claude Code, Cursor, or any AI coding assistant. Adjust the tag range for your release.

````markdown
Write release notes for the Better-Notify release that just landed.

Gather context:
1. Read `.release-please-manifest.json` for current versions.
2. Read the CHANGELOG.md files for each package that was bumped.
3. Run `gh pr list --state merged --search "merged:>YYYY-MM-DD"` to find the merged PRs.
4. Read the PR descriptions for any PR that looks significant.

Then write release notes following the structure in RELEASE-NOTES-GUIDE.md:
- Group commits into user-facing features (one bullet per feature, not per commit).
- Call out breaking changes with migration diffs.
- Skip internal-only changes (CI, refactors, test improvements).
- Link every highlight to its PR.
- Include the packages-released table with versions.

Output the notes as markdown. Don't commit or publish — just print them for review.
`````

### Review the draft

Review before publishing:

- [ ] Does every highlight describe a user-facing change?
- [ ] Are breaking changes listed with migration steps?
- [ ] Are PR links correct?
- [ ] Is the package version table accurate against `.release-please-manifest.json`?
- [ ] Is the tone concise and informative, free of marketing-speak?

---

## Where to publish

1. **GitHub Release** — replace the auto-generated commit list in the GitHub release with the curated notes.
2. **Docs site** — add a blog post or announcement page when the release warrants one.
3. **Social channels** — copy the highlights for announcements (see the Social Announcement section in `RELEASING.md`).

---

## Example

These raw changelog entries:

```
### Features
* **core:** add race, parallel, and mirrored strategies to multiTransport (f9fdd59)
* **core:** implement createClient with executeRender and executeSend (a7a5108)
* **core:** wire built-in logger through createClient send pipeline (ba79e59)
* **core:** add LoggerLike, consoleLogger, and fromPino (e5e88bc)
```

Become:

```markdown
## Highlights

- **Client send pipeline** — `createClient` now handles the full render → send flow
  with built-in logging. Bring your own logger via the `LoggerLike` interface, or use
  the default `consoleLogger`. Pino users can wrap with `fromPino()`. ([#12](link))

- **Multi-transport strategies** — `multiTransport` supports `race`, `parallel`, and
  `mirrored` strategies for sending through multiple providers simultaneously. ([#14](link))
```
