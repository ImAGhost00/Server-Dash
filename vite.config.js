import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/client',
  server: {
    host: '0.0.0.0',
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
});