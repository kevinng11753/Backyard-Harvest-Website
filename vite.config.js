import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// VitePWA turns the site into an installable app: it writes the
// web app manifest (name, icons, colors) and a service worker that
// caches the app so it opens instantly, even on a weak connection.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Backyard Harvest',
        short_name: 'Harvest',
        description: 'Share extra backyard produce with your neighbors.',
        theme_color: '#1f5b3a',
        background_color: '#f4f8f1',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Map tiles and photos come from other servers; don't pre-cache them.
        navigateFallbackDenylist: [/^\/api/]
      }
    })
  ]
})
