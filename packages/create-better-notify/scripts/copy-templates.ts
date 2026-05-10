import { cpSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveWorkspaceVersions, injectVersions } from '../src/inject-versions';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../..');
const src = resolve(root, 'templates');
const dest = resolve(__dirname, '../dist/templates');

cpSync(src, dest, { recursive: true });

const versions = resolveWorkspaceVersions(resolve(root, 'packages'));
injectVersions(dest, versions);
