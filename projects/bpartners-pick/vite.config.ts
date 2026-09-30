import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
  server: {
    // `npm run dev` 때 API 요청은 wrangler(8787)로 넘겨요
    proxy: { '/api': 'http://localhost:8787', '/img': 'http://localhost:8787' },
  },
});
