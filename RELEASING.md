# Releasing BetterNotify

All packages in this monorepo are released together under a single version using [release-please](https://github.com/googleapis/release-please). The pipeline is almost entirely automated — the human steps are writing commits correctly, reviewing the release PR, and verifying the publish.

Current dist-tag: **`alpha`** (all `0.x` releases publish under `--tag alpha`).

---

## How the pipeline works

```
conventional commits → merge to main
  → release-please updates release PR (CHANGELOG + version bumps)
    → merge release PR
      → GitHub release created
        → npm publish (parallel per package, --tag alpha, --provenance)
```

No manual `npm publish` or version tagging is needed.

---

## Pre-release checklist (before merging a feature/fix PR)

- [ ] All commits in the PR use [conventional commit format](#commit-format) — enforced by the PR title linter
- [ ] CI is green: `pnpm ci` passes (build → typecheck → test → lint)
- [ ] No `console.log`, non-null assertions (`!`), or `any` casts in public API surface
- [ ] New public APIs have JSDoc; new behaviour has a test
- [ ] If a package was added, it is listed in `release-please-config.json` and `.release-please-manifest.json` — see [Adding a new package](#adding-a-new-package)

---

## Release PR checklist (when release-please opens or updates its PR)

Release-please opens one PR against `main` titled **"chore: release main"**. It contains version bumps and CHANGELOG updates for every package that had changes since the last release.

- [ ] Read the CHANGELOG diff — confirm the entries reflect the intended changes
- [ ] Verify version bumps match expectations (see [Version bump rules](#version-bump-rules))
- [ ] Confirm CI is green on the release PR itself
- [ ] Merge the PR — **do not squash** (release-please needs the merge commit to track state)

---

## Post-publish verification checklist

After the release PR merges, the `Release Please + npm publish` workflow runs automatically.

- [ ] Open the **Actions** tab and confirm both `release-please` and all `publish` jobs are green
- [ ] Spot-check at least `@betternotify/core` on npm:
  ```sh
  npm view @betternotify/core dist-tags
  # alpha tag should point to the new version
  ```
- [ ] Confirm provenance attestation is visible on the npm package page (shield icon)
- [ ] Smoke-test the new version from a clean install:
  ```sh
  mkdir /tmp/smoke && cd /tmp/smoke
  npm init -y
  npm install @betternotify/core@alpha
  node -e "import('@betternotify/core').then(m => console.log(Object.keys(m)))"
  ```
- [ ] If any publish job failed: re-run the failed job from the Actions tab. The build is idempotent — re-running publishes only the packages that were not yet pushed, since npm rejects duplicate version uploads with a non-fatal error.

---

## Commit format

Release-please reads conventional commits to decide version bumps and CHANGELOG entries. The PR title linter enforces the format on every PR.

```
<type>(<optional scope>): <subject>

# Types that appear in the CHANGELOG:
feat:     new feature → minor bump (patch pre-major, see below)
fix:      bug fix → patch bump
perf:     performance improvement → patch bump

# Types that do NOT appear in the CHANGELOG (housekeeping):
chore:    tooling, dependencies, config
ci:       CI pipeline changes
docs:     documentation only
refactor: internal restructuring without behaviour change
test:     adding or fixing tests
build:    build system changes
style:    formatting
revert:   reverts a previous commit
```

**Breaking changes** (pre-v1): append `!` to the type or add a `BREAKING CHANGE:` footer. Pre-major, these bump **minor** (not major). Document them clearly in the PR description even though the version signal is the same as `feat`.

---

## Version bump rules

Config: `bump-minor-pre-major: true`, `bump-patch-for-minor-pre-major: true`.

| Commit type                   | Pre-v1 bump |
| ----------------------------- | ----------- |
| `fix:`, `perf:`               | patch       |
| `feat:`                       | patch       |
| `feat!:` / `BREAKING CHANGE:` | minor       |

All packages share the same version — if any package has a `feat!:` commit, the whole monorepo bumps minor.

---

## Adding a new package

1. Generate the scaffold with the turbo generator — do not hand-author:
   ```sh
   pnpm exec turbo gen run package
   pnpm install
   ```
2. Add the package to `release-please-config.json`:
   ```json
   "packages/<name>": {
     "release-type": "node",
     "component": "@betternotify/<name>",
     "prerelease-type": "alpha"
   }
   ```
3. Add the initial version to `.release-please-manifest.json`:
   ```json
   "packages/<name>": "0.0.0"
   ```
4. Open a PR with the scaffold + config change. Release-please will create the first release after it merges.

---

## Secrets required in GitHub repository settings

| Secret      | Purpose                                                               |
| ----------- | --------------------------------------------------------------------- |
| `NPM_TOKEN` | Automation token with `publish` scope for the `@betternotify` npm org |

`GITHUB_TOKEN` is the built-in Actions token — no setup needed.

---

## Troubleshooting

**Release PR not created after merging to main**

Release-please only creates a PR when there are releasable commits (`feat:`, `fix:`, `perf:`, or a breaking change) since the last release. `chore:`, `docs:`, `ci:`, `test:`, and `refactor:` commits do not trigger a new release PR.

**Publish job fails with `403 Forbidden`**

The `NPM_TOKEN` secret is missing, expired, or lacks `publish` scope. Rotate the token in the npm dashboard and update the GitHub secret.

**Publish job fails with `409 / version already exists`**

A version was already published (possibly from a previous partial run). This is not a real failure — npm rejected the duplicate. Check if the version is live with `npm view @betternotify/core@<version>`.

**Wrong version bumped**

Check the commit messages merged since the last release. If a `chore:` commit was accidentally written as `feat:`, the CHANGELOG will be wrong. You can manually edit the release PR body before merging to correct the CHANGELOG text; the version bump comes from the commit type and cannot be overridden without editing the PR branch.

**Release PR is stale / out of sync**

Close and re-open release-please PRs by pushing any commit to `main` — release-please will recreate the PR with fresh diffs. Alternatively, re-run the `release-please` workflow manually from the Actions tab.
