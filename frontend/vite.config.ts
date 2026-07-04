import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    // Prevent small images from being inlined as base64 in JS bundles
    // assetsInlineLimit: 0, (removed to save requests)
    rollupOptions: {
      output: {
        // Split vendor chunks for better long-term caching:
        // React/motion/charts won't re-download when only app code changes
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});
