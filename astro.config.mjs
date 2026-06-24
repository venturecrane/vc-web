import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import sitemap from '@astrojs/sitemap'
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
  integrations: [sitemap()],
})
