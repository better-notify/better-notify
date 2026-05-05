#!/usr/bin/env node
import { Cli, z } from 'incur';
import { resolveOptions } from './prompts';
import { scaffold, getTemplateKey } from './scaffold';
import { installDeps } from './pm';
import * as p from '@clack/prompts';

const AVAILABLE_TEMPLATES = ['hono-orpc'];

Cli.create('create-better-notify', {
  description: 'Scaffold a better-notify project',
  version: '0.0.1',
  args: z.object({
    name: z.string().optional().describe('Project name'),
  }),
  options: z.object({
    framework: z.enum(['hono', 'elysia']).optional().describe('HTTP framework'),
    rpc: z.enum(['orpc', 'trpc', 'none']).optional().describe('RPC layer'),
    pm: z.enum(['npm', 'pnpm', 'yarn', 'bun']).optional().describe('Package manager'),
  }),
  async run(c) {
    const options = await resolveOptions({
      name: c.args.name,
      framework: c.options.framework,
      rpc: c.options.rpc,
      pm: c.options.pm,
    });

    const templateKey = getTemplateKey(options);
    if (!AVAILABLE_TEMPLATES.includes(templateKey)) {
      p.cancel(
        `Template "${templateKey}" is not available yet. Available: ${AVAILABLE_TEMPLATES.join(', ')}`,
      );
      process.exit(1);
    }

    p.note(
      [
        `Project:   ${options.name}`,
        `Path:      ${options.path}`,
        `Framework: ${options.framework}`,
        `RPC:       ${options.rpc}`,
        `PM:        ${options.pm}`,
      ].join('\n'),
      'Summary',
    );

    const confirmed = await p.confirm({ message: 'Proceed?' });
    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel('Cancelled.');
      process.exit(0);
    }

    const s = p.spinner();
    s.start('Scaffolding project...');
    const destDir = scaffold(options);
    s.stop('Project scaffolded.');

    s.start(`Installing dependencies with ${options.pm}...`);
    installDeps(destDir, options.pm);
    s.stop('Dependencies installed.');

    p.outro(`Done! cd ${options.path} && ${options.pm} run dev`);

    return {
      name: options.name,
      framework: options.framework,
      rpc: options.rpc,
      pm: options.pm,
      path: destDir,
    };
  },
}).serve();
