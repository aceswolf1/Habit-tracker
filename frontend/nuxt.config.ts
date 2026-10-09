// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Repo-root shared/ (progress + scoring). In Docker build the tree is
// /app/frontend + /app/shared, so ../shared resolves the same as locally.
const sharedDir = resolve(__dirname, '../shared')

export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  modules: [
    '@pinia/nuxt'
  ],
  css: ['~/assets/css/main.css'],
  alias: {
    // UB-13/14: single source of truth for progress + scoring
    '#shared': sharedDir,
  },
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
  // Enable debug mode
  debug: true,
  // Additional logging configuration
  logLevel: process.env.NODE_ENV === 'development' ? 'info' : 'silent',
  // Vue debug tools
  vite: {
    vue: {
      reactivityTransform: true,
      devtools: true
    },
    define: {
      '__VUE_PROD_DEVTOOLS__': true,
    }
  },
  app: {
    head: {
      title: 'PixelPaladin - 8-bit Habit Tracker',
      link: [
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap',
        },
      ],
      meta: [
        {
          name: 'description',
          content: 'A gamified habit tracker with 8-bit pixel graphics and RPG elements'
        }
      ]
    }
  },
  // Set explicit development server port
  devServer: {
    port: 3001
  }
})
