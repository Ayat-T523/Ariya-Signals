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
  build: {
    // Hidden sourcemaps — shipped to Vercel but not listed in HTML, so they don't
    // expose source to end users but DO make browser DevTools stack traces readable.
    sourcemap: 'hidden',
  },
  server: {
    port: parseInt(process.env.PORT) || 5173,
    strictPort: true,
  },
})
