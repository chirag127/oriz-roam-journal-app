// @ts-check
import { shell } from '@chirag127/astro-shell/shell'
import { VitePWA } from 'vite-plugin-pwa'

export default shell({
  site: 'https://journal.oriz.in',
  base: process.env.PUBLIC_BASE_PATH ?? '/',
  vite: {
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        strategies: 'generateSW',
        manifest: {
          name: 'Journal — oriz',
          short_name: 'Journal',
          description: 'Privacy-first PWA journal in the oriz family.',
          start_url: '/dashboard',
          scope: '/',
          display: 'standalone',
          background_color: '#0B0B10',
          theme_color: '#0B0B10',
          orientation: 'portrait-primary',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icons/icon-maskable-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            { name: 'New entry', url: '/entries/new', short_name: 'New' },
            { name: 'Today', url: '/dashboard', short_name: 'Today' },
            { name: 'Calendar', url: '/calendar', short_name: 'Calendar' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2}'],
          navigateFallback: '/offline',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'gfonts-stylesheets' },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gfonts-webfonts',
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\//,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'firebase-storage' },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
  },
})
