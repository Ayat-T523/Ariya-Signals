import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({ filename: 'dist/bundle-stats.html', open: false, gzipSize: true, brotliSize: true }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Hidden sourcemaps — shipped to Vercel but not listed in HTML, so they don't
    // expose source to end users but DO make browser DevTools stack traces readable.
    sourcemap: 'hidden',
  },
  server: {
    port: parseInt(process.env.PORT) || 5173,
    strictPort: true,
  },
  preview: {
    port: parseInt(process.env.PORT) || 4173,
    strictPort: true,
  },
})
