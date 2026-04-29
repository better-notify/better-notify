import { readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGES_DIR = join(import.meta.dirname, '..', '..', '..', 'packages');
const OUTPUT_DIR = join(import.meta.dirname, '..', 'content', 'docs', 'changelog');
const MAX_RECENT = 10;
const GITHUB_BASE = 'https://github.com/better-notify/better-notify/blob/main';

type VersionEntry = {
  version: string;
  date: string;
  body: string;
};

const parseChangelog = (filePath: string): VersionEntry[] => {
  const lines = readFileSync(filePath, 'utf-8').split('\n');
  const entries: VersionEntry[] = [];
  const versionRegex =
    /^## \[?(\d+\.\d+\.\d+(?:-[^\])\s]+)?)\]?(?:\([^)]*\))?\s*\((\d{4}-\d{2}-\d{2})\)/;

  let current: { version: string; date: string; lines: string[] } | null = null;

  for (const line of lines) {
    const match = versionRegex.exec(line);
    if (match) {
      if (current && current.lines.length > 0) {
        entries.push({
          version: current.version,
          date: current.date,
          body: current.lines.join('\n').trim(),
        });
      }
      current = { version: match[1], date: match[2], lines: [] };
      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  if (current && current.lines.length > 0) {
    entries.push({
      version: current.version,
      date: current.date,
      body: current.lines.join('\n').trim(),
    });
  }

  return entries;
};

const run = () => {
  if (existsSync(OUTPUT_DIR)) {
    rmSync(OUTPUT_DIR, { recursive: true });
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const slugs: string[] = [];

  const packages = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const coreIndex = packages.indexOf('core');
  if (coreIndex > 0) {
    packages.splice(coreIndex, 1);
    packages.unshift('core');
  }

  for (const pkg of packages) {
    const changelogPath = join(PACKAGES_DIR, pkg, 'CHANGELOG.md');
    if (!existsSync(changelogPath)) continue;

    const entries = parseChangelog(changelogPath);
    if (entries.length === 0) continue;

    slugs.push(pkg);

    const recent = entries.slice(0, MAX_RECENT);
    const hasOlder = entries.length > MAX_RECENT;

    const versionsBody = recent
      .map((e) => `## v${e.version} (${e.date})\n\n${e.body}`)
      .join('\n\n---\n\n');

    const olderLink = hasOlder
      ? `\n\n---\n\n[View full changelog on GitHub →](${GITHUB_BASE}/packages/${pkg}/CHANGELOG.md)\n`
      : '';

    const mdx = `---
title: "@betternotify/${pkg}"
description: "Changelog for @betternotify/${pkg} — latest: v${entries[0].version}"
icon: History
---

${versionsBody}${olderLink}
`;
    writeFileSync(join(OUTPUT_DIR, `${pkg}.mdx`), mdx);
  }

  const meta = {
    title: 'Changelog',
    pages: slugs,
  };
  writeFileSync(join(OUTPUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

  console.log(`[changelog] generated ${slugs.length} package changelogs`);
};

run();
