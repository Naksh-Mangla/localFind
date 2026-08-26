import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) {
              return 'firebase'
            }
            if (id.includes('qrcode')) {
              return 'qrcode-lib'
            }
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react'
            }
          }
        }
      }
    }
  }
})
