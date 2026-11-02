import { baseConfig } from '@internal/rolldown-config';

export default baseConfig({
  entries: { index: 'src/index.ts' },
  external: ['react', /^react\//, 'react-dom', /^react-dom\//, 'react-email', /^react-email\//],
});
