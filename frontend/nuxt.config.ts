// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
// `@rollup/plugin-commonjs` is a transitive dep of Vite and ships with this
// repo's installed `node_modules`. We import it directly so it can be wired
// into both the Vite client build and the Nitro SSR rollup pipeline — the
// `shared/*.js` files are pure CJS (`module.exports = { … }`) and live
// outside `node_modules`, so both pipelines need an explicit pass.
import commonjs from '@rollup/plugin-commonjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Repo-root shared/ (progress + scoring). In Docker build the tree is
// /app/frontend + /app/shared, so ../shared resolves the same as locally.
const sharedDir = resolve(__dirname, '../shared')

// Match the `shared/` dir at the repo root AND the `#shared/...` alias Vite
// emits, plus absolute/relative forms of the same path.
const sharedInclude = [/shared[\\/]/, /#shared[\\/]/]

export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  modules: [
    '@pinia/nuxt'
  ],
  css: [
    // UB-34: self-hosted fonts (no Google Fonts CDN). Imported before the
    // app stylesheet so `.font-press` / `.font-cyber` family names resolve.
    '@fontsource/press-start-2p',
    '@fontsource/orbitron',
    '~/assets/css/main.css',
  ],
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
  // UB-35: debug + Vue devtools only in development; never leak prod surface.
  debug: process.env.NODE_ENV === 'development',
  // Additional logging configuration
  logLevel: process.env.NODE_ENV === 'development' ? 'info' : 'silent',
  // Vue devtools only in development (UB-35)
  vite: {
    vue: {
      reactivityTransform: true,
      devtools: process.env.NODE_ENV === 'development',
    },
    define: {
      '__VUE_PROD_DEVTOOLS__': process.env.NODE_ENV === 'development',
    },
    // `shared/*.js` is CJS (`module.exports = { … }`). Both the client
    // and the Nitro SSR bundles need a CJS-to-ESM transform applied to
    // `shared/*` so the source's bare `module.exports` never ends up in an
    // emitted `.mjs` file (where it would throw "module is not defined"
    // at runtime in production). See B-FE-5 fix-up — the SSR half is
    // handled below via `nitro.rollupConfig.plugins`.
    build: {
      commonjsOptions: {
        include: [/node_modules/, ...sharedInclude],
        transformMixedEsModules: true,
        defaultIsModuleExports: 'always',
      },
    },
  },
  // B-FE-5: Nitro bundles the SSR side from the same `#shared/...` imports.
  // Inject `@rollup/plugin-commonjs` scoped to the repo `shared/` dir so the
  // raw `module.exports = { … }` literal in `shared/progress.js` and
  // `shared/scoring.js` gets rewritten to `export const …` / named exports
  // before the SSR output is emitted.
  nitro: {
    rollupConfig: {
      plugins: [
        commonjs({
          include: sharedInclude,
          transformMixedEsModules: true,
          defaultIsModuleExports: 'always',
        }),
      ],
    },
  },
  app: {
    head: {
      title: 'PixelPaladin - 8-bit Habit Tracker',
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
