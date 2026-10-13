import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'node:fs';

export default defineConfig({
  plugins: [
    react(),
    {
      // The browser only notices an update when sw.js changes byte-for-byte, so
      // stamp a fresh build id into the emitted worker on every build and expose
      // it as /build.txt for the in-app version label.
      name: 'stamp-sw',
      apply: 'build',
      closeBundle() {
        const stamp = Date.now().toString(36);
        const swPath = 'dist/sw.js';
        writeFileSync(swPath, readFileSync(swPath, 'utf8').replace('__BUILD__', stamp), 'utf8');
        writeFileSync('dist/build.txt', stamp, 'utf8');
      },
    },
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
