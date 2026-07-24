import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web client',
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
          if (url.pathname === '/') {
            if (url.searchParams.has('screenId')) {
              req.url = '/index.html' + url.search;
            } else {
              req.url = '/controller.html' + url.search;
            }
          } else if (url.pathname === '/screen') {
            req.url = '/index.html' + url.search;
          }
          next();
        });
      }
    }
  ]
});
