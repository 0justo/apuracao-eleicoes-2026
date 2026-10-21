import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 3000,
    watch: {
      // Impede que o Vite dispare full-reload da página (flicker e perda de scroll)
      // quando o poller do backend atualiza os arquivos em public/snapshots/ ou o SQLite.
      ignored: [
        '**/public/snapshots/**',
        '**/backend/data/**',
        '**/*.db*',
        '**/*.sqlite*',
      ],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
