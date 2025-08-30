import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  plugins: [
    basicSsl()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000,
    open: true,
    https: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts'
  }
});