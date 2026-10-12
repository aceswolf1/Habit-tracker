// scripts/preview/nuxt-internal-loader.mjs — Nuxt dev SSR import patcher.
//
// Nuxt 3.17.x writes `.nuxt/dist/server/server.mjs` with literal
// `import { baseURL } from "#internal/nuxt/paths";` lines. The dev SSR
// worker (forked by Nitro) tries to resolve `#internal/nuxt/paths` via
// Node's package-imports feature, but Nuxt never adds the corresponding
// `imports` block to the project's `package.json` — that wiring exists
// only in the production `.output/` build. Without it, every SSR request
// in `nuxt dev` 500s with `Package import specifier not defined`.
//
// We can't touch `frontend/package.json` (out of scope per the W4 plan),
// so this file is loaded via `NODE_OPTIONS="--import <this-file>"`. Node
// pre-loads it before user code; the exported `resolve` hook is then
// registered for ALL module resolution that follows (including forks).
//
// Usage (parent env propagates to the Nitro fork):
//   NODE_OPTIONS="--import $(pwd)/scripts/preview/nuxt-internal-loader.mjs" \
//     npx nuxt dev
//
// No new dependencies. Uses only `node:module` and `node:url` (Node 22+).

import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const frontendDir = pathResolve(__dirname, '..', '..', 'frontend');
const nuxtDist    = pathResolve(frontendDir, 'node_modules', 'nuxt', 'dist');
const nitroRuntimeDir = pathResolve(frontendDir, 'node_modules', 'nitropack', 'dist', 'runtime');

const REDIRECTS = new Map([
  ['#internal/nuxt/paths', pathResolve(nuxtDist, 'core/runtime/nitro/utils/paths.js')],
  ['#internal/nitro',      pathResolve(nitroRuntimeDir, 'index.mjs')],
]);

// Register this file itself as a module resolver. Node loads the URL and
// reads the `resolve` export below.
register('file://' + __filename);

// Exported hooks are picked up by `register()` from the file URL above.
// Node's module loader hook API calls `resolve(specifier, context, next)`
// for every import in the host process.
export async function resolve(specifier, context, nextResolve) {
  if (REDIRECTS.has(specifier)) {
    const url = pathToFileURL(REDIRECTS.get(specifier)).href;
    return { url, shortCircuit: true, format: 'module' };
  }
  return nextResolve(specifier, context);
}