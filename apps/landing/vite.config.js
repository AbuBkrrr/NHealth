import { defineConfig } from 'vite';

export default defineConfig({
  build: { outDir: 'dist', sourcemap: false, target: 'es2019', chunkSizeWarningLimit: 900 },
  server: { port: 5173 },
});
