/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/chat-mfe',
  server:{
    port: 4204,
    host: 'localhost',
    cors: true,
  },
  preview:{
    port: 4204,
    host: 'localhost',
    cors: true,
  },
  plugins: [react(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  build: {
    outDir: '../../dist/apps/chat-mfe',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
      input: {
        main: './index.html',
        remoteEntry: './src/remote-entry.tsx',
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'remoteEntry' ? 'remoteEntry.js' : 'assets/[name]-[hash].js';
        },
      },
    },
  },
  test: {
    name: 'chat-mfe',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/chat-mfe',
      provider: 'v8' as const,
    }
  },
}));
