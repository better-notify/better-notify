import { describe, it, expect, afterEach } from 'vitest';
import { detectPackageManager, getInstallCommand } from './pm';

describe('detectPackageManager', () => {
  const originalEnv = process.env.npm_config_user_agent;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.npm_config_user_agent;
    } else {
      process.env.npm_config_user_agent = originalEnv;
    }
  });

  it('detects pnpm', () => {
    process.env.npm_config_user_agent = 'pnpm/10.0.0 node/v22.0.0';
    expect(detectPackageManager()).toBe('pnpm');
  });

  it('detects yarn', () => {
    process.env.npm_config_user_agent = 'yarn/4.0.0 node/v22.0.0';
    expect(detectPackageManager()).toBe('yarn');
  });

  it('detects bun', () => {
    process.env.npm_config_user_agent = 'bun/1.0.0 node/v22.0.0';
    expect(detectPackageManager()).toBe('bun');
  });

  it('defaults to npm when user agent is missing', () => {
    delete process.env.npm_config_user_agent;
    expect(detectPackageManager()).toBe('npm');
  });

  it('defaults to npm for unknown user agent', () => {
    process.env.npm_config_user_agent = 'npm/10.0.0 node/v22.0.0';
    expect(detectPackageManager()).toBe('npm');
  });
});

describe('getInstallCommand', () => {
  it('returns yarn for yarn', () => {
    expect(getInstallCommand('yarn')).toBe('yarn');
  });

  it('returns npm install for npm', () => {
    expect(getInstallCommand('npm')).toBe('npm install');
  });

  it('returns pnpm install for pnpm', () => {
    expect(getInstallCommand('pnpm')).toBe('pnpm install');
  });

  it('returns bun install for bun', () => {
    expect(getInstallCommand('bun')).toBe('bun install');
  });
});
