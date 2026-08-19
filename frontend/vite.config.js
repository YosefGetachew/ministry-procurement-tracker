import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Bind on all interfaces (both IPv4 and IPv6 loopback) — on some
    // Windows setups Vite's default "localhost" bind resolves to the IPv6
    // loopback only, which a browser resolving localhost to 127.0.0.1
    // can't reach.
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('error', (_error, _request, response) => {
            if (response && 'req' in response && !response.headersSent && !response.writableEnded) {
              response.writeHead(503, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({
                error: 'The procurement API is unavailable. Start the application from the project root with npm start.',
              }));
            }
          });
        },
      },
    },
  },
});
