// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  modules: [
    '@pinia/nuxt'
  ],
  css: ['~/assets/css/main.css'],
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
