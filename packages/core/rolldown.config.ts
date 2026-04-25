import { baseConfig } from '@internal/rolldown-config';

export default baseConfig({
  entries: {
    index: 'src/index.ts',
    sender: 'src/sender.ts',
    worker: 'src/worker.ts',
    webhook: 'src/webhook.ts',
    provider: 'src/provider.ts',
    template: 'src/template.ts',
    queue: 'src/queue.ts',
    middleware: 'src/middleware.ts',
    test: 'src/test.ts',
    config: 'src/config.ts',
  },
});
