/// <reference types="vitest" />
import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const appVersion = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')
) as { version: string };

export default defineConfig(() => {
  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion.version),
    },
    plugins: [react(), tailwindcss()],
    // Keep the app shell same-origin so PWA files (`/manifest.webmanifest`,
    // `/sw.js`) are not rewritten to a CDN origin and blocked by CORS.
    base: '/',
    build: {
      // WebLLM is intentionally large but lazily loaded only when needed.
      // Raise warning threshold to avoid noisy warnings for that known chunk.
      chunkSizeWarningLimit: 7000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@mlc-ai/web-llm')) return 'web-llm';
            if (id.includes('node_modules/firebase')) return 'firebase';
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react-vendor';
            if (id.includes('node_modules/motion')) return 'motion';
            if (id.includes('node_modules/lucide-react')) return 'icons';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify-file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      pool: 'forks',
      forks: {
        execArgv: ['--max-old-space-size=2048'],
      },
      env: {
        VITE_FIREBASE_API_KEY: 'test-api-key',
        VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
        VITE_FIREBASE_PROJECT_ID: 'test-project',
        VITE_FIREBASE_STORAGE_BUCKET: 'test.appspot.com',
        VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
        VITE_FIREBASE_APP_ID: '1:123:web:abc',
        VITE_FIREBASE_MEASUREMENT_ID: 'G-TEST',
        VITE_FIREBASE_DATABASE_ID: 'test-db',
      },
    },
  };
});
