import { execSync } from 'node:child_process';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export const detectPackageManager = (): PackageManager => {
  const ua = process.env.npm_config_user_agent ?? '';
  if (ua.startsWith('pnpm/')) return 'pnpm';
  if (ua.startsWith('yarn/')) return 'yarn';
  if (ua.startsWith('bun/')) return 'bun';
  return 'npm';
};

export const getInstallCommand = (pm: PackageManager): string => {
  return pm === 'yarn' ? 'yarn' : `${pm} install`;
};

export const installDeps = (cwd: string, pm: PackageManager): void => {
  execSync(getInstallCommand(pm), { cwd, stdio: 'inherit' });
};
