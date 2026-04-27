import { defineConfig, type RolldownOptions } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

export type BaseConfigOptions = {
  entries: Record<string, string>;
  external?: (string | RegExp)[];
};

export const baseConfig = (opts: BaseConfigOptions): RolldownOptions => {
  return defineConfig({
    input: opts.entries,
    output: [
      {
        dir: 'dist',
        format: 'esm',
        entryFileNames: '[name].js',
        chunkFileNames: 'shared/[name]-[hash].js',
      },
    ],
    platform: 'node',
    external: [/^node:/, /^@betternotify\//, /^@standard-schema\//, ...(opts.external ?? [])],
    plugins: [dts({ resolve: true })],
    treeshake: true,
  });
};
