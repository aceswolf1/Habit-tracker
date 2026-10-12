/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy pixel-* tokens (kept for back-compat with W3 markup that
        // still references `bg-pixel-dark` etc.).
        'pixel-dark': 'var(--color-pixel-dark)',
        'pixel-darkblue': 'var(--color-pixel-darkblue)',
        'pixel-midblue': 'var(--color-pixel-midblue)',
        'pixel-lightblue': 'var(--color-pixel-lightblue)',
        'pixel-offwhite': 'var(--color-pixel-offwhite)',

        // UB-57: `pixel.*` family reads from the new `--pp-*` design tokens
        // defined in `frontend/assets/css/tokens.css`. FE workers replace
        // raw hex literals in their own files with these token-driven
        // utilities; nothing here duplicates the existing pixel-* aliases.
        'pixel-bg-deepest': 'var(--pp-bg-deepest)',
        'pixel-bg-deep':    'var(--pp-bg-deep)',
        'pixel-bg-mid':     'var(--pp-bg-mid)',
        'pixel-bg-up':      'var(--pp-bg-up)',
        'pixel-bg-panel':   'var(--pp-bg-panel)',
        'pixel-bg-card':    'var(--pp-bg-card)',
        'pixel-text':       'var(--pp-text)',
        'pixel-text-muted': 'var(--pp-text-muted)',
        'pixel-bronze':     'var(--pp-bronze)',
        'pixel-silver':     'var(--pp-silver)',
        'pixel-gold':       'var(--pp-gold)',
        'pixel-gold-acc':   'var(--pp-gold-acc)',
        'pixel-gold-dk':    'var(--pp-gold-dk)',
        'pixel-gold-bd':    'var(--pp-gold-bd)',
        'pixel-gold-pale':  'var(--pp-gold-pale)',
        'pixel-champion':   'var(--pp-champion)',
        'pixel-purple':     'var(--pp-purple)',
        'pixel-blue':       'var(--pp-blue)',
        'pixel-blue-mid':   'var(--pp-blue-mid)',
        'pixel-cancel':     'var(--pp-cancel)',
        'pixel-danger':     'var(--pp-danger)',
        'pixel-danger-lt':  'var(--pp-danger-lt)',
        'pixel-success':    'var(--pp-success)',
        'pixel-emerald':    'var(--pp-emerald)',
        'pixel-orange':     'var(--pp-orange)',
        'pixel-orange-lt':  'var(--pp-orange-lt)',
        'pixel-gray':       'var(--pp-gray)',
        'pixel-gray-mid':   'var(--pp-gray-mid)',
      },
      fontFamily: {
        'pixel': ['"Press Start 2P"', 'cursive'],
      }
    },
  },
  plugins: [],
}