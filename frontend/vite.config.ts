import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    strictPort: false,
    allowedHosts: ['*'],
    proxy: {
      '/api/stream/ws': {
        target: 'https://agenticai-backend.azurewebsites.net/',
        changeOrigin: true,
        ws: true,
      },
      '/api': {
        target: 'https://agenticai-backend.azurewebsites.net/',
        changeOrigin: true,
        secure: false,
        // SSE: disable buffering so events stream through Cloudflare tunnels
        configure: (proxy) => {
          // Strip Accept-Encoding on SSE requests so upstream doesn't gzip
          // (compressed chunks get buffered by proxies/tunnels)
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.url?.includes('/api/stream/')) {
              proxyReq.removeHeader('Accept-Encoding')
            }
          })
          proxy.on('proxyRes', (proxyRes) => {
            const ct = proxyRes.headers['content-type'] || ''
            if (ct.includes('text/event-stream')) {
              proxyRes.headers['X-Accel-Buffering'] = 'no'
              proxyRes.headers['Cache-Control'] = 'no-cache, no-store, no-transform'
            }
          })
        },
      },
    },
  },
})
