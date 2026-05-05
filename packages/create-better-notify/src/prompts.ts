import * as p from '@clack/prompts';
import type { ScaffoldOptions } from './scaffold';
import type { PackageManager } from './pm';
import { detectPackageManager } from './pm';

export type ResolvedOptions = ScaffoldOptions & { pm: PackageManager };

const NAME_RE = /^[a-z0-9@][a-z0-9._\-/]*$/;

export const validateName = (value: string | undefined): string | undefined => {
  if (!value) return 'Required';
  if (!NAME_RE.test(value)) return 'Invalid package name';
};

export const resolveOptions = async (partial: {
  name?: string;
  path?: string;
  framework?: string;
  rpc?: string;
  pm?: string;
}): Promise<ResolvedOptions> => {
  p.intro('create-better-notify');

  const nameError = partial.name ? validateName(partial.name) : undefined;
  if (nameError) {
    p.cancel(nameError);
    process.exit(1);
  }

  const name = partial.name ?? (await promptText('Project name', 'my-app'));
  const path = partial.path ?? (await promptPath(name));
  const framework =
    (partial.framework as ScaffoldOptions['framework']) ?? (await promptFramework());
  const rpc = (partial.rpc as ScaffoldOptions['rpc']) ?? (await promptRpc());
  const pm = (partial.pm as PackageManager) ?? (await promptPackageManager());

  return { name, path, framework, rpc, pm };
};

const promptPath = (name: string): Promise<string> => {
  return handleCancel(
    p.text({
      message: 'Project path',
      initialValue: name,
      validate: (v) => {
        if (!v) return 'Required';
      },
    }),
  );
};

const promptPackageManager = (): Promise<PackageManager> => {
  const detected = detectPackageManager();
  return handleCancel(
    p.select({
      message: 'Package manager',
      initialValue: detected,
      options: [
        { value: 'pnpm' as const, label: 'pnpm' },
        { value: 'npm' as const, label: 'npm' },
        { value: 'yarn' as const, label: 'yarn' },
        { value: 'bun' as const, label: 'bun' },
      ],
    }),
  );
};

const promptText = (message: string, placeholder: string): Promise<string> => {
  return handleCancel(
    p.text({
      message,
      placeholder,
      validate: validateName,
    }),
  );
};

const promptFramework = (): Promise<ScaffoldOptions['framework']> => {
  return handleCancel(
    p.select({
      message: 'Framework',
      options: [{ value: 'hono' as const, label: 'Hono' }],
    }),
  );
};

const promptRpc = (): Promise<ScaffoldOptions['rpc']> => {
  return handleCancel(
    p.select({
      message: 'RPC layer',
      options: [{ value: 'orpc' as const, label: 'oRPC' }],
    }),
  );
};

const handleCancel = async <T>(promise: Promise<T | symbol>): Promise<T> => {
  const result = await promise;
  if (p.isCancel(result)) {
    p.cancel('Cancelled.');
    process.exit(0);
  }
  return result;
};
