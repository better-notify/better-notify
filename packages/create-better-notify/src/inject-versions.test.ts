import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveWorkspaceVersions, injectVersions } from './inject-versions';

describe('resolveWorkspaceVersions', () => {
  let packagesDir: string;

  beforeEach(() => {
    packagesDir = mkdtempSync(join(tmpdir(), 'bn-versions-'));
  });

  afterEach(() => {
    rmSync(packagesDir, { recursive: true, force: true });
  });

  it('reads name and version from each package directory', () => {
    mkdirSync(join(packagesDir, 'core'));
    writeFileSync(
      join(packagesDir, 'core', 'package.json'),
      JSON.stringify({ name: '@betternotify/core', version: '1.0.0-beta.2' }),
    );
    mkdirSync(join(packagesDir, 'smtp'));
    writeFileSync(
      join(packagesDir, 'smtp', 'package.json'),
      JSON.stringify({ name: '@betternotify/smtp', version: '1.0.0-beta.1' }),
    );

    const versions = resolveWorkspaceVersions(packagesDir);

    expect(versions).toEqual({
      '@betternotify/core': '1.0.0-beta.2',
      '@betternotify/smtp': '1.0.0-beta.1',
    });
  });

  it('skips directories without a package.json', () => {
    mkdirSync(join(packagesDir, 'no-pkg'));
    mkdirSync(join(packagesDir, 'core'));
    writeFileSync(
      join(packagesDir, 'core', 'package.json'),
      JSON.stringify({ name: '@betternotify/core', version: '2.0.0' }),
    );

    const versions = resolveWorkspaceVersions(packagesDir);

    expect(versions).toEqual({ '@betternotify/core': '2.0.0' });
  });

  it('skips packages missing name or version', () => {
    mkdirSync(join(packagesDir, 'no-name'));
    writeFileSync(
      join(packagesDir, 'no-name', 'package.json'),
      JSON.stringify({ version: '1.0.0' }),
    );
    mkdirSync(join(packagesDir, 'no-version'));
    writeFileSync(
      join(packagesDir, 'no-version', 'package.json'),
      JSON.stringify({ name: '@betternotify/foo' }),
    );

    const versions = resolveWorkspaceVersions(packagesDir);

    expect(versions).toEqual({});
  });

  it('handles prerelease versions correctly', () => {
    mkdirSync(join(packagesDir, 'core'));
    writeFileSync(
      join(packagesDir, 'core', 'package.json'),
      JSON.stringify({ name: '@betternotify/core', version: '1.0.0-beta.2' }),
    );

    const versions = resolveWorkspaceVersions(packagesDir);

    expect(versions['@betternotify/core']).toBe('1.0.0-beta.2');
  });
});

describe('injectVersions', () => {
  let templatesDir: string;

  beforeEach(() => {
    templatesDir = mkdtempSync(join(tmpdir(), 'bn-templates-'));
  });

  afterEach(() => {
    rmSync(templatesDir, { recursive: true, force: true });
  });

  it('replaces 0.0.0-inject with the matching version', () => {
    mkdirSync(join(templatesDir, 'hono-orpc'));
    writeFileSync(
      join(templatesDir, 'hono-orpc', 'package.json'),
      JSON.stringify({
        dependencies: {
          '@betternotify/core': '0.0.0-inject',
          '@betternotify/smtp': '0.0.0-inject',
        },
      }),
    );

    injectVersions(templatesDir, {
      '@betternotify/core': '1.0.0-beta.2',
      '@betternotify/smtp': '1.0.0-beta.1',
    });

    const pkg = JSON.parse(readFileSync(join(templatesDir, 'hono-orpc', 'package.json'), 'utf-8'));
    expect(pkg.dependencies['@betternotify/core']).toBe('1.0.0-beta.2');
    expect(pkg.dependencies['@betternotify/smtp']).toBe('1.0.0-beta.1');
  });

  it('does not modify non-inject versions', () => {
    mkdirSync(join(templatesDir, 'hono-orpc'));
    writeFileSync(
      join(templatesDir, 'hono-orpc', 'package.json'),
      JSON.stringify({
        dependencies: {
          '@betternotify/core': '0.0.0-inject',
          hono: '4.12.18',
        },
      }),
    );

    injectVersions(templatesDir, { '@betternotify/core': '1.0.0-beta.2' });

    const pkg = JSON.parse(readFileSync(join(templatesDir, 'hono-orpc', 'package.json'), 'utf-8'));
    expect(pkg.dependencies.hono).toBe('4.12.18');
  });

  it('leaves inject placeholder unchanged when no matching version exists', () => {
    mkdirSync(join(templatesDir, 'hono-orpc'));
    writeFileSync(
      join(templatesDir, 'hono-orpc', 'package.json'),
      JSON.stringify({
        dependencies: {
          '@betternotify/unknown': '0.0.0-inject',
        },
      }),
    );

    injectVersions(templatesDir, { '@betternotify/core': '1.0.0-beta.2' });

    const pkg = JSON.parse(readFileSync(join(templatesDir, 'hono-orpc', 'package.json'), 'utf-8'));
    expect(pkg.dependencies['@betternotify/unknown']).toBe('0.0.0-inject');
  });

  it('injects into devDependencies as well', () => {
    mkdirSync(join(templatesDir, 'hono-orpc'));
    writeFileSync(
      join(templatesDir, 'hono-orpc', 'package.json'),
      JSON.stringify({
        devDependencies: {
          '@betternotify/core': '0.0.0-inject',
        },
      }),
    );

    injectVersions(templatesDir, { '@betternotify/core': '1.0.0-beta.2' });

    const pkg = JSON.parse(readFileSync(join(templatesDir, 'hono-orpc', 'package.json'), 'utf-8'));
    expect(pkg.devDependencies['@betternotify/core']).toBe('1.0.0-beta.2');
  });

  it('handles multiple templates', () => {
    mkdirSync(join(templatesDir, 'hono-orpc'));
    mkdirSync(join(templatesDir, 'elysia'));
    writeFileSync(
      join(templatesDir, 'hono-orpc', 'package.json'),
      JSON.stringify({ dependencies: { '@betternotify/core': '0.0.0-inject' } }),
    );
    writeFileSync(
      join(templatesDir, 'elysia', 'package.json'),
      JSON.stringify({ dependencies: { '@betternotify/core': '0.0.0-inject' } }),
    );

    injectVersions(templatesDir, { '@betternotify/core': '1.0.0-beta.2' });

    const pkg1 = JSON.parse(readFileSync(join(templatesDir, 'hono-orpc', 'package.json'), 'utf-8'));
    const pkg2 = JSON.parse(readFileSync(join(templatesDir, 'elysia', 'package.json'), 'utf-8'));
    expect(pkg1.dependencies['@betternotify/core']).toBe('1.0.0-beta.2');
    expect(pkg2.dependencies['@betternotify/core']).toBe('1.0.0-beta.2');
  });
});
