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
    // V2: every shape is sharp (0 px radius). `full` is kept only for
    // status dots and avatar circles (contract §1). Anything else trying
    // to use a default radius will get 0.
    borderRadius: {
      none: "0",
      DEFAULT: "0",
      sm: "0",
      md: "0",
      lg: "0",
      xl: "0",
      "2xl": "0",
      "3xl": "0",
      full: "9999px",
    },
    extend: {
      colors: {
        // V2 Combat Deck — `pp-*` utilities (contract §1).
        // Each value is `var(--pp-*)` so they pick up the tokens.css source.
        'pp-void':         'var(--pp-void)',
        'pp-panel':        'var(--pp-panel)',
        'pp-card':         'var(--pp-card)',
        'pp-card-active':  'var(--pp-card-active)',
        'pp-line':         'var(--pp-line)',
        'pp-text':         'var(--pp-text)',
        'pp-muted':        'var(--pp-muted)',
        'pp-cyan':         'var(--pp-cyan)',
        'pp-magenta':      'var(--pp-magenta)',
        'pp-amber':        'var(--pp-amber)',
        'pp-green':        'var(--pp-green)',
        'pp-danger':       'var(--pp-danger)',
        'pp-done':         'var(--pp-done-bg)',
        'pp-bronze':       'var(--pp-bronze)',
        'pp-silver':       'var(--pp-silver)',
        'pp-gold':         'var(--pp-gold)',
        'pp-gold-acc':     'var(--pp-gold-acc)',
        'pp-gold-dk':      'var(--pp-gold-dk)',
        'pp-gold-bd':      'var(--pp-gold-bd)',
        'pp-gold-pale':    'var(--pp-gold-pale)',
        'pp-champion':     'var(--pp-champion)',
        'pp-final':        'var(--pp-final)',
        'pp-black':        'var(--pp-black)',
      },
      fontFamily: {
        // V2 type: Space Grotesk for display, JetBrains Mono for body /
        // data terminal text. Both are self-hosted via @fontsource.
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // V2 type scale (contract §1, .claude/v2/DESIGN.md).
        // `lineHeight` and `letterSpacing` are bundled with the size;
        // `fontWeight` is bundled too so a single class writes the whole
        // rule. Uppercase is applied at the call site via Tailwind's
        // `uppercase` utility.
        'display':            ['32px', { lineHeight: '40px', letterSpacing: '0.08em', fontWeight: '700' }],
        'headline-lg':        ['24px', { lineHeight: '32px', letterSpacing: '0.05em', fontWeight: '700' }],
        'headline-lg-mobile': ['18px', { lineHeight: '24px', letterSpacing: '0.04em', fontWeight: '700' }],
        'headline-md':        ['18px', { lineHeight: '24px', letterSpacing: '0.04em', fontWeight: '600' }],
        'headline-sm':        ['14px', { lineHeight: '20px', letterSpacing: '0.06em', fontWeight: '700' }],
        'body-lg':            ['14px', { lineHeight: '22px', letterSpacing: '0.02em', fontWeight: '500' }],
        'body-md':            ['12px', { lineHeight: '18px', letterSpacing: '0.02em', fontWeight: '400' }],
        'body-sm':            ['11px', { lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '400' }],
        'label-lg':           ['12px', { lineHeight: '16px', letterSpacing: '0.08em', fontWeight: '700' }],
        'label-md':           ['10px', { lineHeight: '14px', letterSpacing: '0.1em',  fontWeight: '700' }],
        'label-sm':           ['9px',  { lineHeight: '12px', letterSpacing: '0.12em', fontWeight: '700' }],
      },
      spacing: {
        // V2 spacing scale (contract §1, DESIGN.md).
        'space-xs':  '0.25rem',
        'space-sm':  '0.5rem',
        'space-md':  '0.75rem',
        'space-lg':  '1rem',
        'space-xl':  '1.5rem',
        'gutter':    '0.75rem',
        'margin':    '1rem',
        'margin-md': '1.5rem',
        'margin-lg': '2rem',
      },
      boxShadow: {
        // V2 glow ramps (static, never animated — contract §1).
        'glow-cyan':    '0 0 10px rgba(0,240,255,.45), inset 0 0 6px rgba(0,240,255,.2)',
        'glow-magenta': '0 0 12px rgba(255,0,127,.5), inset 0 0 4px rgba(255,0,127,.25)',
        'glow-amber':   '0 0 8px rgba(255,190,11,.4)',
      },
    },
  },
  plugins: [],
}