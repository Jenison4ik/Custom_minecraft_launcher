import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname),
  publicDir: resolve(__dirname,'./static'),
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
}); 