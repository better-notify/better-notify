import { defineConfig, type RolldownOptions } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'

export interface BaseConfigOptions {
  entries: Record<string, string>
  external?: (string | RegExp)[]
}

export function baseConfig(opts: BaseConfigOptions): RolldownOptions {
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
    external: [
      /^node:/,
      /^@emailrpc\//,
      /^@standard-schema\//,
      ...(opts.external ?? []),
    ],
    plugins: [dts({ resolve: true })],
    treeshake: true,
  })
}
