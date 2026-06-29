import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: '/lcbasketball',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      base: '/lcbasketball',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: null,
      },
      manifest: {
        name: 'LC Basketball Playbook',
        short_name: 'LC Playbook',
        description: 'Lawrence County Warriors basketball playbook and stats tracker',
        theme_color: '#cc0000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'any',
        start_url: '/lcbasketball',
        scope: '/lcbasketball',
        icons: [
          { src: '/lcbasketball/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/lcbasketball/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/lcbasketball/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { 
    host: '0.0.0.0',
    port: 5173
  },
})
