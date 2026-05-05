# Releasing Better-Notify

Repeatable checklist for cutting a release. The pipeline is fully automated via release-please and GitHub Actions — this document covers the human verification layer around it.

## How the pipeline works

1. Conventional commits land on `main`.
2. Release-please opens (or updates) a release PR bumping versions and changelogs.
3. Merging the release PR triggers the `release.yml` workflow:
   - **npm publish**: each affected package publishes to npm with the `alpha` dist-tag (matrix job, one per package).
   - **Docs deploy**: `apps/web` deploys to Cloudflare Workers (only when `apps/web` is part of the release).
4. GitHub releases and tags (`@betternotify/<package>-v<version>`) are created automatically.

Preview packages (`0.0.0-preview.<pr>.<sha>`) published during CI clean up automatically when the PR closes.

---

## 1. Changelog generation and review

Before merging the release PR:

- [ ] Open the release-please PR and review every `CHANGELOG.md` diff.
- [ ] Verify entries match the actual changes — misleading commits produce misleading changelogs.
- [ ] Confirm breaking changes are called out explicitly.
- [ ] Confirm version bumps are correct — `alpha` pre-releases should bump patch, not minor/major, unless intentional.
- [ ] Verify `.release-please-manifest.json` versions match what you expect.

`apps/web/scripts/generate-changelog.ts` runs during `prebuild` and pulls each package's `CHANGELOG.md` into the docs site. Changelogs must be committed (via the release PR) before the web build runs.

## 2. Package publish order and verification

All packages build and publish in parallel via a matrix job. After merging the release PR:

- [ ] Watch the `Release Please + npm publish` workflow in GitHub Actions.
- [ ] Confirm all matrix jobs pass (one per released package, up to 16 packages + web).
- [ ] Spot-check a published package:

  ```sh
  npm info @betternotify/core versions --json | tail -5
  npm info @betternotify/core dist-tags
  ```

- [ ] Verify the `alpha` dist-tag points to the new version.
- [ ] For packages that depend on other `@betternotify/*` packages, confirm the published `package.json` references the correct version range (not a stale `workspace:*`).

### Current packages

| Package                          | Path                           |
| -------------------------------- | ------------------------------ |
| `@betternotify/core`             | `packages/core`                |
| `@betternotify/email`            | `packages/email`               |
| `@betternotify/sms`              | `packages/sms`                 |
| `@betternotify/push`             | `packages/push`                |
| `@betternotify/react-email`      | `packages/react-email`         |
| `@betternotify/mjml`             | `packages/mjml`                |
| `@betternotify/handlebars`       | `packages/handlebars`          |
| `@betternotify/smtp`             | `packages/smtp`                |
| `@betternotify/resend`           | `packages/resend`              |
| `@betternotify/cloudflare-email` | `packages/cloudflare-email`    |
| `@betternotify/bullmq`           | `packages/bullmq`              |
| `@betternotify/slack`            | `packages/slack`               |
| `@betternotify/discord`          | `packages/discord`             |
| `@betternotify/telegram`         | `packages/telegram`            |
| `@betternotify/zapier`           | `packages/zapier`              |
| `create-better-notify`           | `packages/create-better-notify` |

`apps/web` (`@betternotify/web`) deploys to Cloudflare Workers via a separate job — it is never published to npm.

### If a publish job fails

1. Check the workflow logs for the failing matrix entry.
2. Common causes:
   - **npm auth**: verify `NPM_TOKEN` secret is valid and has publish access to the `@betternotify` scope.
   - **Version conflict**: the version already exists on npm (retry won't help — bump and re-release).
   - **Build failure**: run `pnpm --filter <package> build` locally to reproduce.
3. Fix the issue, land the fix on `main`, and let release-please pick it up in the next cycle.

## 3. Docs deploy and version alignment

The docs site (`apps/web`) deploys to Cloudflare Workers only when `apps/web` is included in the release PR.

- [ ] Confirm the `deploy-web` job ran and succeeded (it gates on `web_release_created`).
- [ ] Visit the production docs URL and verify:
  - Changelog pages reflect the newly released versions (generated from `CHANGELOG.md` files by `apps/web/scripts/generate-changelog.ts`).
  - Installation snippets show the correct version/tag.
  - API docs match the released code.
- [ ] If docs need a deploy without a package release, manually trigger or push a docs-only change that bumps `apps/web`.

### If the docs deploy fails

1. Check the `deploy-web` job logs.
2. Common causes:
   - **Cloudflare auth**: verify `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` secrets.
   - **Build failure**: run `pnpm exec turbo run build --filter=@betternotify/web...` locally.
3. Re-run the failed job or push a fix.

## 4. Example verification

Verify examples work with the released versions.

- [ ] `examples/welcome-text`: install fresh and run:

  ```sh
  cd examples/welcome-text
  pnpm install
  pnpm start
  ```

- [ ] Confirm it runs without errors and produces expected output.
- [ ] Verify any examples added since the last release the same way.

Add new examples to this checklist as they appear in `examples/`.

## 5. Social announcement

> This section is a placeholder — define channels and templates as the project grows.

- [ ] Draft announcement covering: what changed, who benefits, migration notes (if any).
- [ ] Post to relevant channels (TBD: Twitter/X, Discord, GitHub Discussions, etc.).
- [ ] Link to the changelog or release notes.
- [ ] Highlight migration steps for any breaking changes.

---

## Required secrets

| Secret                          | Used by                   | Purpose                       |
| ------------------------------- | ------------------------- | ----------------------------- |
| `BETTER_NOTIFY_APP_ID`          | release-please            | GitHub App authentication     |
| `BETTER_NOTIFY_APP_PRIVATE_KEY` | release-please            | GitHub App authentication     |
| `NPM_TOKEN`                     | publish + preview         | npm registry publish access   |
| `CLOUDFLARE_ACCOUNT_ID`         | deploy-web + preview docs | Cloudflare Workers deployment |
| `CLOUDFLARE_API_TOKEN`          | deploy-web + preview docs | Cloudflare Workers deployment |

## Quick reference

```sh
# Check latest published versions
npm info @betternotify/core dist-tags

# Check all alpha versions
npm info @betternotify/core versions --json

# Run full CI locally before release
pnpm ci

# Build and verify docs locally
pnpm exec turbo run build --filter=@betternotify/web...

# Run examples
cd examples/welcome-text && pnpm install && pnpm start
```
