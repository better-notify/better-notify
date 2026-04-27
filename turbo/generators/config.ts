import type { PlopTypes } from '@turbo/gen';

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setHelper('kebab', (s: string) =>
    String(s)
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase(),
  );

  plop.setGenerator('package', {
    description: 'Scaffold a new @emailrpc/* package under packages/',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Package name (without scope), e.g. "ses":',
        validate: (v: string) => /^[a-z][a-z0-9-]*$/.test(v) || 'lowercase, numbers, dashes only',
      },
      {
        type: 'input',
        name: 'description',
        message: 'One-line description:',
      },
    ],
    actions: [
      {
        type: 'addMany',
        destination: '{{ turbo.paths.root }}/packages/{{ kebab name }}',
        base: 'templates/package',
        templateFiles: 'templates/package/**/*',
        globOptions: { dot: true },
      },
    ],
  });

  plop.setGenerator('example', {
    description: 'Scaffold a new example under examples/ (apps/cli + packages/emails)',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Example name, e.g. "password-reset":',
        validate: (v: string) => /^[a-z][a-z0-9-]*$/.test(v) || 'lowercase, numbers, dashes only',
      },
    ],
    actions: [
      {
        type: 'addMany',
        destination: '{{ turbo.paths.root }}/examples/{{ kebab name }}',
        base: 'templates/example',
        templateFiles: 'templates/example/**/*',
        globOptions: { dot: true },
      },
    ],
  });
}
