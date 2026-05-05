import * as p from '@clack/prompts';
import type { ScaffoldOptions } from './scaffold';

export const resolveOptions = async (partial: {
  name?: string;
  framework?: string;
  rpc?: string;
}): Promise<ScaffoldOptions> => {
  p.intro('create-betternotify');

  const name = partial.name ?? (await promptText('Project name', 'my-app'));
  const framework =
    (partial.framework as ScaffoldOptions['framework']) ?? (await promptFramework());
  const rpc = (partial.rpc as ScaffoldOptions['rpc']) ?? (await promptRpc());

  return { name, framework, rpc };
};

const promptText = (message: string, placeholder: string): Promise<string> => {
  return handleCancel(
    p.text({
      message,
      placeholder,
      validate: (v) => {
        if (!v) return 'Required';
        if (!/^[a-z0-9@][a-z0-9._\-/]*$/.test(v)) return 'Invalid package name';
      },
    }),
  );
};

const promptFramework = (): Promise<ScaffoldOptions['framework']> => {
  return handleCancel(
    p.select({
      message: 'Framework',
      options: [
        { value: 'hono' as const, label: 'Hono' },
        { value: 'elysia' as const, label: 'Elysia', hint: 'coming soon' },
      ],
    }),
  );
};

const promptRpc = (): Promise<ScaffoldOptions['rpc']> => {
  return handleCancel(
    p.select({
      message: 'RPC layer',
      options: [
        { value: 'orpc' as const, label: 'oRPC' },
        { value: 'trpc' as const, label: 'tRPC', hint: 'coming soon' },
        { value: 'none' as const, label: 'None' },
      ],
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
