import { cpSync, readFileSync, writeFileSync, readdirSync, renameSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type ScaffoldOptions = {
  name: string;
  path: string;
  framework: 'hono' | 'elysia';
  rpc: 'orpc' | 'trpc' | 'none';
};

type ScaffoldContext = {
  templatesDir?: string;
  cwd?: string;
};

const DEFAULT_TEMPLATES_DIR = resolve(fileURLToPath(import.meta.url), '../templates');

export const getTemplateKey = (options: ScaffoldOptions): string => {
  if (options.rpc === 'none') return options.framework;
  return `${options.framework}-${options.rpc}`;
};

export const scaffold = (options: ScaffoldOptions, ctx?: ScaffoldContext): string => {
  const templatesDir = ctx?.templatesDir ?? DEFAULT_TEMPLATES_DIR;
  const cwd = ctx?.cwd ?? process.cwd();
  const templateKey = getTemplateKey(options);
  const templateDir = resolve(templatesDir, templateKey);
  const destDir = resolve(cwd, options.path);

  cpSync(templateDir, destDir, { recursive: true });

  renameUnderscoredFiles(destDir);

  replacePlaceholders(destDir, {
    '{{name}}': options.name,
  });

  return destDir;
};

const replacePlaceholders = (dir: string, replacements: Record<string, string>): void => {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      replacePlaceholders(fullPath, replacements);
      continue;
    }

    if (!isTextFile(entry)) continue;
    let content = readFileSync(fullPath, 'utf-8');

    for (const [placeholder, value] of Object.entries(replacements)) {
      content = content.replaceAll(placeholder, value);
    }

    writeFileSync(fullPath, content);
  }
};

const KNOWN_TEXT_DOTFILES = new Set(['.gitignore', '.env', '.env.example', '.npmrc', '.eslintrc']);

const isTextFile = (filename: string): boolean => {
  const textExts = ['.ts', '.tsx', '.json', '.md', '.yaml', '.yml', '.txt'];
  return textExts.some((ext) => filename.endsWith(ext)) || KNOWN_TEXT_DOTFILES.has(filename);
};

const renameUnderscoredFiles = (dir: string): void => {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      renameUnderscoredFiles(fullPath);
      continue;
    }
    if (entry.name.startsWith('_')) {
      renameSync(fullPath, join(dir, `.${entry.name.slice(1)}`));
    }
  }
};
