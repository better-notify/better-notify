#!/usr/bin/env node
import { Cli, z } from 'incur';
import { resolveOptions } from './prompts';
import { scaffold, getTemplateKey } from './scaffold';
import { detectPackageManager, installDeps } from './pm';
import * as p from '@clack/prompts';

const AVAILABLE_TEMPLATES = ['hono-orpc'];

Cli.create('create-betternotify', {
  description: 'Scaffold a better-notify project',
  version: '0.1.0',
  args: z.object({
    name: z.string().optional().describe('Project name'),
  }),
  options: z.object({
    framework: z.enum(['hono', 'elysia']).optional().describe('HTTP framework'),
    rpc: z.enum(['orpc', 'trpc', 'none']).optional().describe('RPC layer'),
  }),
  async run(c) {
    const options = await resolveOptions({
      name: c.args.name,
      framework: c.options.framework,
      rpc: c.options.rpc,
    });

    const templateKey = getTemplateKey(options);
    if (!AVAILABLE_TEMPLATES.includes(templateKey)) {
      p.cancel(
        `Template "${templateKey}" is not available yet. Available: ${AVAILABLE_TEMPLATES.join(', ')}`,
      );
      process.exit(1);
    }

    const s = p.spinner();
    s.start('Scaffolding project...');
    const destDir = scaffold(options);
    s.stop('Project scaffolded.');

    const pm = detectPackageManager();
    s.start(`Installing dependencies with ${pm}...`);
    installDeps(destDir, pm);
    s.stop('Dependencies installed.');

    p.outro(`Done! cd ${options.name} && ${pm} run dev`);

    return {
      name: options.name,
      framework: options.framework,
      rpc: options.rpc,
      path: destDir,
    };
  },
}).serve();
