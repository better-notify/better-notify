import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';

const execFileAsync = promisify(execFile);

describe('welcome email template', () => {
  test('renders through the CLI from the package entrypoint', async () => {
    const cliDir = fileURLToPath(new URL('../../../apps/cli', import.meta.url));
    const script = [
      "import { createClient } from '@emailrpc/core';",
      "import { emails } from '@welcome-text/emails';",
      "void (async () => {",
      "const mail = createClient({ catalog: emails, transports: [], ctx: { baseUrl: 'example.com' } });",
      "const output = await mail.welcome.render({ name: 'John', verifyUrl: 'https://example.com/verify' });",
      "console.log(output.html.includes('Welcome'));",
      "})();",
    ].join(' ');
    const { stdout } = await execFileAsync('pnpm', ['exec', 'tsx', '-e', script], {
      cwd: cliDir,
    });

    expect(stdout.trim()).toBe('true');
  }, 10000);
});
