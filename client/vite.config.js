import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// React, the router and the query cache change rarely: keep them in their own cached chunk
const VENDOR = /[\/]node_modules[\/](react|react-dom|react-router|react-router-dom|scheduler|@tanstack[\/][^\/]+)[\/]/

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (VENDOR.test(id)) return 'vendor'
        },
      },
    },
  },
})
