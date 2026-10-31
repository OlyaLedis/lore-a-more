import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // An installable app (home screen, its own window) with a service worker that keeps the app itself
    // (its pages, code, and icons) on the phone, so it opens without a connection. Stories and maps
    // still need one: they come live from Convex and MapTiler and aren't cached.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Loramore',
        short_name: 'Loramore',
        description: 'Stories tied to real places, to read where they happened.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#fafaf9',
        background_color: '#fafaf9',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // The map code (MapLibre) is one large file.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Any address in the app opens the app, offline too (it has its own routes).
        navigateFallback: '/index.html',
      },
    }),
  ],
})
