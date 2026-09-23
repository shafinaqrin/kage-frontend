/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        pixel: 'var(--m3-primary)',
        surface: 'var(--m3-surface)',
        'surface-container': 'var(--m3-surface-container)',
        'surface-high': 'var(--m3-surface-container-high)',
        'surface-highest': 'var(--m3-surface-container-highest)',
        ink: 'var(--m3-on-surface)',
        muted: 'var(--m3-on-surface-variant)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        spring: 'var(--ease-spring)',
      },
    },
  },
  plugins: [],
}
