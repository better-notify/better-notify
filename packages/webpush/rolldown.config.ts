import { baseConfig } from '@internal/rolldown-config';

export default baseConfig({
  entries: {
    index: 'src/index.ts',
    'transports/index': 'src/transports/index.ts',
  },
});
