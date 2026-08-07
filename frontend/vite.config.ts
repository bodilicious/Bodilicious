import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { compression } from 'vite-plugin-compression2';
import { visualizer } from 'rollup-plugin-visualizer';

const isAnalyze = process.env.ANALYZE === 'true';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Pre-compress all JS/CSS/HTML/SVG at build time — zero CPU cost per request on Render's CDN
    compression({ 
      algorithms: ['brotliCompress', 'gzip'], 
      exclude: [/\.(png|jpe?g|webp|avif|gif|ico|woff2?)$/] 
    }),
    // Bundle analyzer — only runs when ANALYZE=true, never in CI/production
    ...(isAnalyze ? [visualizer({ open: true, gzipSize: true, brotliSize: true, filename: 'dist/bundle-stats.html' })] : []),
  ],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 500, // Warn on chunks > 500 KiB to catch regressions
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React runtime — cached forever, changes rarely
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/') || id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          // Framer Motion — large but used on most pages
          if (id.includes('node_modules/framer-motion/')) {
            return 'vendor-motion';
          }
          // Recharts — admin analytics only
          if (id.includes('node_modules/recharts/') || id.includes('node_modules/d3') || id.includes('node_modules/victory-')) {
            return 'vendor-charts';
          }
          // Lucide icons — tree-shakeable but large in aggregate
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          // Firebase — large SDK, only needed when authenticated
          if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) {
            return 'vendor-firebase';
          }
          // PostHog — analytics, non-critical
          if (id.includes('node_modules/posthog-js/') || id.includes('node_modules/posthog-')) {
            return 'vendor-posthog';
          }
          // TipTap rich text editor — admin blog editor only
          if (id.includes('node_modules/@tiptap/') || id.includes('node_modules/prosemirror')) {
            return 'vendor-tiptap';
          }
          // DnD Kit — admin only
          if (id.includes('node_modules/@dnd-kit/')) {
            return 'vendor-dndkit';
          }
          // PapaParse + rc-slider — specific features only
          if (id.includes('node_modules/papaparse/') || id.includes('node_modules/rc-slider/')) {
            return 'vendor-misc';
          }
        },
      },
    },
  },
});


