import { baseConfig } from '@internal/rolldown-config'

export default baseConfig({
  entries: { index: 'src/index.ts' },
  external: ['bullmq', 'ioredis'],
})
