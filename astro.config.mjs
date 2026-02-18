import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import sitemap from '@astrojs/sitemap'
import AstroPWA from '@vite-pwa/astro'
import { rehypeAccessibleOverflow } from './src/plugins/rehype-accessible-overflow.js'

export default defineConfig({
  site: 'https://venturecrane.com',
  output: 'static',
  build: {
    inlineStylesheets: 'always',
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
    rehypePlugins: [rehypeAccessibleOverflow],
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    sitemap(),
    AstroPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Venture Crane',
        short_name: 'VC',
        description: 'A development lab building real products with AI agents.',
        start_url: '/',
        display: 'standalone',
        background_color: '#1a1a2e',
        theme_color: '#1a1a2e',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: undefined,
        globPatterns: ['**/*.{css,js,html,svg,png,ico,txt,woff,woff2}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
