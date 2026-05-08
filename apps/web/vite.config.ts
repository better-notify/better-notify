import react from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import mdx from 'fumadocs-mdx/vite';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  server: {
    port: 4265,
    proxy: {
      '/ingest/static': {
        target: 'https://eu-assets.i.posthog.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ingest/, ''),
      },
      '/ingest/array': {
        target: 'https://eu-assets.i.posthog.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ingest/, ''),
      },
      '/ingest': {
        target: 'https://eu.i.posthog.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ingest/, ''),
      },
    },
  },
  ssr: {
    optimizeDeps: {
      exclude: ['beautiful-mermaid'],
    },
  },
  resolve: {
    tsconfigPaths: true,
    dedupe: ['react', 'react-dom'],
    alias: {
      tslib: 'tslib/tslib.es6.js',
    },
  },
  plugins: [
    mdx(await import('./source.config')),
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart({ prerender: { enabled: true } }),
    react(),
  ],
});
