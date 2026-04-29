import { defineConfig, type RolldownOptions } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';
import { bundleAnalyzerPlugin } from 'rolldown/experimental';

const shouldAnalyzeBundle = process.env.BUNDLE_ANALYZE === 'true';

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
        sourcemap: false,
        entryFileNames: '[name].js',
        chunkFileNames: 'shared/[name]-[hash].js',
      },
    ],
    platform: 'node',
    external: [/^node:/, /^@betternotify\//, /^@standard-schema\//, ...(opts.external ?? [])],
    plugins: [
      dts({ resolve: true, sourcemap: false }),
      ...(shouldAnalyzeBundle
        ? [
            bundleAnalyzerPlugin({
              fileName: 'bundle-analysis.json',
              format: 'json',
            }),
          ]
        : []),
    ],
    treeshake: true,
  });
};
