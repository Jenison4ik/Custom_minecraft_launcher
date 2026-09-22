import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

function classicScriptForElectron(): Plugin {
  return {
    name: "classic-script-for-electron",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        /<script type="module"(?: crossorigin)? /g,
        "<script defer "
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), classicScriptForElectron()],
  root: resolve(__dirname),
  publicDir: resolve(__dirname,'./static'),
  base: './',
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
}); 