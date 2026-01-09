import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    // Production optimizations
    target: 'es2015',
    minify: 'esbuild', // Use esbuild for faster builds (terser has config issues)

    // Code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'pdf-vendor': ['react-pdf', 'pdfjs-dist'],
          'dnd-vendor': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },

    // Chunk size warnings
    chunkSizeWarningLimit: 1000,

    // Source maps (disable for production, enable for debugging)
    sourcemap: false,
  },

  // Server configuration (dev only)
  server: {
    port: 5173,
    strictPort: false,
    host: true,
  },

  // Preview configuration
  preview: {
    port: 4173,
    strictPort: false,
    host: true,
  },
})
