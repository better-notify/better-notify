import { baseConfig } from '@internal/rolldown-config';

export default baseConfig({
  entries: {
    index: 'src/index.ts',
    sender: 'src/sender.ts',
    worker: 'src/worker.ts',
    webhook: 'src/webhook.ts',
    transports: 'src/transports/index.ts',
    template: 'src/template.ts',
    queue: 'src/queue.ts',
    middlewares: 'src/middlewares/index.ts',
    plugins: 'src/plugins/index.ts',
    stores: 'src/stores/index.ts',
    sinks: 'src/sinks/index.ts',
    tracers: 'src/tracers/index.ts',
    config: 'src/config.ts',
    logger: 'src/logger.ts',
  },
});
