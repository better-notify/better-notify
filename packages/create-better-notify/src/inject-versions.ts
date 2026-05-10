import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const resolveWorkspaceVersions = (packagesDir: string): Record<string, string> => {
  const result: Record<string, string> = {};
  const dirs = readdirSync(packagesDir);
  for (const dir of dirs) {
    const pkgPath = join(packagesDir, dir, 'package.json');
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.name && pkg.version) {
        result[pkg.name] = pkg.version;
      }
    } catch {
      continue;
    }
  }
  return result;
};

export const injectVersions = (templatesDir: string, versions: Record<string, string>): void => {
  const templates = readdirSync(templatesDir);
  for (const template of templates) {
    const pkgPath = join(templatesDir, template, 'package.json');
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      for (const depType of ['dependencies', 'devDependencies'] as const) {
        const deps = pkg[depType];
        if (!deps) continue;
        for (const [name, version] of Object.entries(deps)) {
          if (version === '0.0.0-inject' && versions[name]) {
            deps[name] = versions[name];
          }
        }
      }
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    } catch {
      continue;
    }
  }
};
