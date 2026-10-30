import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const API = 'http://127.0.0.1:3000';

function spaFallback(): Plugin {
  const rewrite = (req: { url?: string }) => {
    const raw = req.url || '';
    const queryAt = raw.indexOf('?');
    const url = queryAt >= 0 ? raw.slice(0, queryAt) : raw;
    const search = queryAt >= 0 ? raw.slice(queryAt) : '';
    if (url === '/' || url.startsWith('/blog') || url.startsWith('/about') || url === '/index.html' || url === '/landing.html') {
      req.url = `/marketing.html${search}`;
    }
  };
  return {
    name: 'marketing-spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        rewrite(req);
        next();
      });
    },
  };
}

const assetProxy = {
  target: API,
  changeOrigin: true,
};

export default defineConfig({
  root: __dirname,
  publicDir: false,
  appType: 'spa',
  plugins: [react(), spaFallback()],
  base: '/',
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: 'dist-site',
    emptyOutDir: true,
    assetsDir: 'site-assets',
    rollupOptions: {
      input: path.resolve(__dirname, 'marketing.html'),
    },
  },
  server: {
    proxy: {
      '/api': assetProxy,
      '/app': assetProxy,
      '/lordicon.js': assetProxy,
      '/plan-icons': assetProxy,
      '/doodle-motif-10-puzzle-in-reveal.json': assetProxy,
      '/doodle-motif-316-growth-in-reveal.json': assetProxy,
      '/doodle-motif-709-cloud-user-in-reveal.json': assetProxy,
      '/Ace_logo.png': assetProxy,
      '/app-preview.png': assetProxy,
    },
  },
  preview: {
    proxy: {
      '/api': assetProxy,
      '/app': assetProxy,
      '/lordicon.js': assetProxy,
      '/plan-icons': assetProxy,
      '/Ace_logo.png': assetProxy,
      '/app-preview.png': assetProxy,
    },
  },
});
