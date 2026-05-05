import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getTemplateKey, scaffold } from './scaffold';

describe('getTemplateKey', () => {
  it('returns framework-rpc for non-none rpc', () => {
    expect(getTemplateKey({ name: 'x', framework: 'hono', rpc: 'orpc' })).toBe('hono-orpc');
  });

  it('returns framework only when rpc is none', () => {
    expect(getTemplateKey({ name: 'x', framework: 'hono', rpc: 'none' })).toBe('hono');
  });
});

describe('scaffold', () => {
  let tempDir: string;
  let templateDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'create-bn-test-'));
    templateDir = join(tempDir, 'templates', 'hono-orpc');
    mkdirSync(join(templateDir, 'src'), { recursive: true });
    writeFileSync(join(templateDir, 'package.json'), '{ "name": "{{name}}" }\n');
    writeFileSync(join(templateDir, 'src', 'server.ts'), 'console.log("{{name}}")\n');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('copies template and replaces name placeholder in package.json', () => {
    const dest = scaffold(
      { name: 'my-app', framework: 'hono', rpc: 'orpc' },
      { templatesDir: join(tempDir, 'templates'), cwd: tempDir },
    );

    const pkg = readFileSync(join(dest, 'package.json'), 'utf-8');
    expect(pkg).toContain('"name": "my-app"');
  });

  it('replaces placeholders in nested files', () => {
    const dest = scaffold(
      { name: 'my-app', framework: 'hono', rpc: 'orpc' },
      { templatesDir: join(tempDir, 'templates'), cwd: tempDir },
    );

    const server = readFileSync(join(dest, 'src', 'server.ts'), 'utf-8');
    expect(server).toContain('console.log("my-app")');
    expect(server).not.toContain('{{name}}');
  });

  it('creates output directory matching project name', () => {
    const dest = scaffold(
      { name: 'test-project', framework: 'hono', rpc: 'orpc' },
      { templatesDir: join(tempDir, 'templates'), cwd: tempDir },
    );

    expect(dest).toContain('test-project');
    const pkg = readFileSync(join(dest, 'package.json'), 'utf-8');
    expect(pkg).toContain('"name": "test-project"');
  });
});
