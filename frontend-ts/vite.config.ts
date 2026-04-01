import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          const normalizedId = id.replace(/\\/g, '/');

          if (normalizedId.includes('node_modules')) {
            if (
              normalizedId.includes('/react/') ||
              normalizedId.includes('/react-dom/') ||
              normalizedId.includes('/react-router-dom/')
            ) {
              return 'vendor';
            }
            if (normalizedId.includes('/recharts/')) {
              return 'charts-vendor';
            }
            if (normalizedId.includes('/xlsx/') || normalizedId.includes('/papaparse/')) {
              return 'exam-io-vendor';
            }
          }

          if (normalizedId.includes('/src/pages/employee/reports/charts/')) {
            return 'reports-charts';
          }
          if (normalizedId.includes('/src/pages/employee/exams/examParsers.ts')) {
            return 'exam-parsers';
          }

          return undefined;
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
