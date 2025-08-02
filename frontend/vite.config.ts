// frontend/vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': {
        // --- THIS IS THE MATCHING CHANGE ---
        // We explicitly target the IPv4 address.
        target: 'ws://127.0.0.1:8000',
        ws: true,
        rewrite: (path) => path.replace(/^\/ws/, ''),
      },
    },
  },
})