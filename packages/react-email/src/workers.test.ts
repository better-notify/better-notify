import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { rolldown, type OutputChunk, type RolldownOptions } from 'rolldown';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workDir = join(packageDir, 'node_modules', '.cache', 'workers-test');
const distDir = join(workDir, 'dist');

const buildPackage = async (): Promise<OutputChunk[]> => {
  const configPath = join(packageDir, 'rolldown.config.ts');
  const { default: config }: { default: RolldownOptions } = await import(configPath);
  const bundle = await rolldown({ ...config, cwd: packageDir, plugins: [] });
  const { output } = await bundle.generate({ format: 'esm', dir: 'dist' });
  await bundle.close();
  return output.filter((item): item is OutputChunk => item.type === 'chunk');
};

const workerEntry = `
import { createElement } from 'react';
import { reactEmail } from './dist/index.js';

const Welcome = ({ name }) =>
  createElement('html', null, createElement('body', null, createElement('h1', null, 'Hello, ' + name + '!')));

export default {
  async fetch() {
    const result = await reactEmail(Welcome, { name: 'Workers' }, { plainText: true });
    return Response.json(result);
  },
};
`;

const bundleWorker = async (): Promise<string> => {
  const entry = join(workDir, 'worker.js');
  await writeFile(entry, workerEntry);
  const bundle = await rolldown({
    input: entry,
    platform: 'browser',
    resolve: { conditionNames: ['workerd', 'worker', 'browser', 'import', 'default'] },
    external: [/^node:/],
    logLevel: 'silent',
  });
  const { output } = await bundle.generate({ format: 'esm', codeSplitting: false });
  await bundle.close();
  const [chunk] = output;
  const scriptPath = join(workDir, 'worker.bundle.js');
  await writeFile(scriptPath, chunk.code);
  return scriptPath;
};

describe('reactEmail build output', () => {
  let chunks: OutputChunk[] = [];

  beforeAll(async () => {
    chunks = await buildPackage();
  });

  it('emits a single chunk', () => {
    expect(chunks.map((chunk) => chunk.fileName)).toEqual(['index.js']);
  });

  it('keeps react, react-dom and react-email external', () => {
    const [chunk] = chunks;
    if (!chunk) throw new Error('missing chunk');
    expect(chunk.imports).toEqual(expect.arrayContaining(['react', 'react-email']));
    expect(chunk.code).not.toContain('createRequire');
    expect(chunk.code).not.toContain('node:module');
    expect(chunk.code).not.toMatch(
      /react-dom\/server|renderToReadableStream|renderToPipeableStream/,
    );
  });
});

describe('reactEmail on Cloudflare Workers', () => {
  let mf: Miniflare | undefined;

  beforeAll(async () => {
    await rm(workDir, { recursive: true, force: true });
    await mkdir(distDir, { recursive: true });
    for (const chunk of await buildPackage()) {
      const file = join(distDir, chunk.fileName);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, chunk.code);
    }
    mf = new Miniflare({
      modules: true,
      scriptPath: await bundleWorker(),
      compatibilityDate: '2025-09-01',
      compatibilityFlags: ['nodejs_compat'],
    });
    await mf.ready;
  }, 60_000);

  afterAll(async () => {
    await mf?.dispose();
    await rm(workDir, { recursive: true, force: true });
  });

  it('starts the worker and renders an email in workerd', async () => {
    const res = await mf?.dispatchFetch('http://localhost/');
    const body = (await res?.json()) as { html: string; text: string };
    expect(res?.status).toBe(200);
    expect(body.html).toContain('Hello, Workers!');
    expect(body.text).toContain('Hello, Workers!');
  });
});
