/// <reference types='vitest' />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import fs from 'node:fs';
import path from 'node:path';

function remoteEntryDevPlugin(): Plugin {
  return {
    name: 'remote-entry-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const origin = req.headers['origin'];
        const allowedOrigins = [
          'http://localhost:4200',
          'http://127.0.0.1:4200',
          'http://localhost:4204',
          'http://127.0.0.1:4204',
        ];
        const corsOrigin =
          typeof origin === 'string' && allowedOrigins.includes(origin)
            ? origin
            : 'http://localhost:4200';

        const url = req.url?.split('?')[0];
        if (url === '/remoteEntry.js') {
          const distPath = path.resolve(import.meta.dirname, '../../dist/apps/chat-mfe/remoteEntry.js');
          if (fs.existsSync(distPath)) {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Access-Control-Allow-Origin', corsOrigin);
            res.setHeader('Vary', 'Origin');
            res.end(fs.readFileSync(distPath));
            return;
          }
        }
        if (url?.startsWith('/assets/')) {
          const assetFile = url.replace('/assets/', '');
          const assetPath = path.resolve(import.meta.dirname, '../../dist/apps/chat-mfe/assets', assetFile);
          if (fs.existsSync(assetPath)) {
            const ext = path.extname(assetPath);
            const mime = ext === '.css' ? 'text/css' : 'application/javascript';
            res.setHeader('Content-Type', mime);
            res.setHeader('Access-Control-Allow-Origin', corsOrigin);
            res.setHeader('Vary', 'Origin');
            res.end(fs.readFileSync(assetPath));
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/chat-mfe',
  envDir: '../../',
  server: {
    port: 4204,
    host: '127.0.0.1',
    cors: {
      origin: [
        'http://localhost:4200',
        'http://127.0.0.1:4200',
        'http://localhost:4204',
        'http://127.0.0.1:4204',
      ],
    },
  },
  preview: {
    port: 4204,
    host: '127.0.0.1',
    cors: {
      origin: [
        'http://localhost:4200',
        'http://127.0.0.1:4200',
        'http://localhost:4204',
        'http://127.0.0.1:4204',
      ],
    },
  },
  plugins: [
    react(),
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md']),
    remoteEntryDevPlugin(),
  ],
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
    },
  },
}));
