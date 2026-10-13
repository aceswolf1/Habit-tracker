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

// A-T5: env-configurable build dir. Lets the preview dev server use
// `.nuxt-preview` (managed by w4-backend) so verification runs (`nuxt dev`,
// `nuxt build`, `NUXT_BUILD_DIR=…`) don't trample the live preview's
// build artifacts. Default stays `.nuxt` so existing flows are unchanged.
const buildDir = process.env.NUXT_BUILD_DIR || '.nuxt'

// V2: `vite.build.commonjsOptions` only runs for production builds. In
// `nuxt dev` the browser receives `shared/*.js` as raw CJS, so the namespace
// import in `utils/sharedProgress.ts` finds no exports ("calculateProgress
// is not a function") and the current month never loads. This dev-only
// client transform wraps the CJS body and re-exports the keys listed in its
// `module.exports = { … }` literal. Prod builds and SSR are untouched.
const sharedFile = /[\\/]shared[\\/](progress|scoring)\.js$/
const sharedCjsDevPlugin = {
  name: 'pp-shared-cjs-dev',
  apply: 'serve' as const,
  enforce: 'pre' as const,
  transform(code: string, id: string, options?: { ssr?: boolean }) {
    if (options?.ssr || !sharedFile.test(id.split('?')[0])) return null
    const match = code.match(/module\.exports\s*=\s*\{([^}]*)\}/)
    if (!match) return null
    const keys = match[1]
      .split(',')
      .map((k) => k.split(':')[0].trim())
      .filter((k) => /^[A-Za-z_$][\w$]*$/.test(k))
    return {
      code: [
        'const module = { exports: {} };',
        'const exports = module.exports;',
        code,
        'export default module.exports;',
        // Aliased so the export names never collide with the file's own
        // top-level declarations (e.g. `function generateUuid`).
        ...keys.map((k) => `const __pp_${k} = module.exports.${k};`),
        `export { ${keys.map((k) => `__pp_${k} as ${k}`).join(', ')} };`,
      ].join('\n'),
      map: null,
    }
  },
}

export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  buildDir, // A-T5
  devtools: { enabled: true },
  modules: [
    '@pinia/nuxt'
  ],
  css: [
    // V2 (W1): self-hosted type — only the latin weights used by the FE.
    // Body default = JetBrains Mono; display = Space Grotesk. No CDN,
    // no Google Fonts URLs anywhere in `frontend/`.
    '@fontsource/space-grotesk/600.css',
    '@fontsource/space-grotesk/700.css',
    '@fontsource/jetbrains-mono/400.css',
    '@fontsource/jetbrains-mono/500.css',
    '@fontsource/jetbrains-mono/700.css',
    // Design tokens first so every later stylesheet can resolve
    // `var(--pp-*)` even when the consuming component is scoped.
    '~/assets/css/tokens.css',
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
    plugins: [sharedCjsDevPlugin],
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
    // A-T4: Nuxt's dev-bundler hardcodes `#shared` as `external` (it lives
    // in `node_modules/@nuxt/vite-builder/dist/chunks/dev-bundler.mjs`),
    // which means Vite emits `#shared/...` as a literal subpath import in
    // `.nuxt/dist/server/server.mjs`. Once Nitropack rewrites that emitted
    // bundle for prod it's fine, but `nuxt dev` ships that literal straight
    // to Node ESM and Node throws `ERR_PACKAGE_IMPORT_NOT_DEFINED` for
    // `#shared`. Forcing `#shared` into `ssr.noExternal` makes Vite bundle
    // it through the same commonjs transform as everything else, so the
    // emitted dev bundle never carries a literal `#shared` specifier.
    ssr: {
      noExternal: [/^#shared\//],
    },
  },
  // B-FE-5 / A-T4: Nitro bundles the SSR side from the same `#shared/...` imports.
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
      title: 'PixelPaladin — Combat Deck Habit Tracker',
      meta: [
        {
          name: 'description',
          content: 'A gamified cyberpunk habit tracker with RPG progression'
        },
        { name: 'theme-color', content: '#090b10' },
        { name: 'application-name', content: 'PixelPaladin' },
        { name: 'apple-mobile-web-app-title', content: 'PixelPaladin' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192.png' },
        { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/icon-512.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      ],
    }
  },
  // Set explicit development server port
  devServer: {
    port: 3001
  }
})
