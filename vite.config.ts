import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [],
      includeManifestIcons: false,
      manifest: {
        name: 'AG Pocket — Antigravity Mobile Command Center',
        short_name: 'AG Pocket',
        description:
          'Official-first mobile companion, prompt studio, skill deck, and local workspace organizer for Google Antigravity.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//i,
          /^\/auth\//i,
          /^\/oauth/i,
          /^\/login/i,
          /^\/signin/i,
          /^\/session/i,
          /^\/token/i,
          /^\/offline\.html$/i,
          /\/manifest\.webmanifest$/i,
          /\.(?:json|webmanifest|xml|txt|svg|png|ico|js|css|html|map|woff2?)$/i,
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(?:[^/]+\.)?google\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/antigravity\.google(?:\/.*)?$/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/(?:auth|oauth|login|signin|session|token)(?:\/|\?|$)/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/dexie') || id.includes('node_modules/zod') || id.includes('node_modules/zustand')) {
            return 'vendor-core';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: './src/test/setup.ts',
  },
});
