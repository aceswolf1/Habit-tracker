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
        'pixel-dark': 'var(--color-pixel-dark)',
        'pixel-darkblue': 'var(--color-pixel-darkblue)',
        'pixel-midblue': 'var(--color-pixel-midblue)',
        'pixel-lightblue': 'var(--color-pixel-lightblue)',
        'pixel-offwhite': 'var(--color-pixel-offwhite)',
      },
      fontFamily: {
        'pixel': ['"Press Start 2P"', 'cursive'],
      }
    },
  },
  plugins: [],
}
