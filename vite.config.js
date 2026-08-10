import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Vite development server configuration for LG Arkanoid.
//
// This is used only during local development on a laptop/desktop. On the
// actual Liquid Galaxy rig, Chromium connects directly to the Express
// server on port 3000 -- Vite is not involved in production at all.
//
// The proxy rules forward Socket.IO and health-check requests from the
// Vite dev server (port 5173) to the Express game server (port 3000).
// ---------------------------------------------------------------------------

export default defineConfig({
  root: 'web-client',
  // Keep Vite 4.x for Node 16 / LG Ubuntu 16.04 glibc ceiling (see CI matrix).
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'web-client/index.html'),
        controller: path.resolve(__dirname, 'web-client/controller.html'),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true
      },
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  plugins: [
    {
      name: 'lg-arkanoid-router',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

          // Match numeric screen paths like /1, /2, /3 etc.
          // Rewrite them to serve index.html (the Phaser game).
          const screenMatch = url.pathname.match(/^\/(\d+)$/);
          if (screenMatch) {
            req.url = '/index.html' + url.search;
          } else if (url.pathname === '/controller') {
            req.url = '/controller.html' + url.search;
          }
          next();
        });
      }
    }
  ]
});
