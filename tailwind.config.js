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
        // Material 3 roles referenced beyond the basic surface set.
        'primary': 'var(--m3-primary)',
        'on-primary': 'var(--m3-on-primary)',
        'primary-container': 'var(--m3-primary-container)',
        'on-primary-container': 'var(--m3-on-primary-container)',
        'secondary-container': 'var(--m3-secondary-container)',
        'on-secondary-container': 'var(--m3-on-secondary-container)',
        'tertiary-container': 'var(--m3-tertiary-container)',
        'on-tertiary-container': 'var(--m3-on-tertiary-container)',
        scrim: 'var(--m3-scrim)',
        // Trading-signal colours used by tone helpers and pills.
        positive: 'var(--positive)',
        'positive-container': 'var(--positive-container)',
        negative: 'var(--negative)',
        'negative-container': 'var(--negative-container)',
        flat: 'var(--flat)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        spring: 'var(--ease-spring)',
      },
      borderRadius: {
        // The panel and inner-surface radii used across the tables.
        panel: '1.6rem',
        panelinner: '1.15rem',
      },
      keyframes: {
        'pulse-opacity': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        'surface-in': {
          from: { opacity: '0', transform: 'translateY(1rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'detail-in': {
          from: { opacity: '0', transform: 'translateY(-0.35rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        spin: {
          from: { transform: 'rotate(0turn)' },
          to: { transform: 'rotate(1turn)' },
        },
      },
      animation: {
        'pulse-opacity': 'pulse-opacity 1.4s var(--ease-standard) infinite',
        'surface-in': 'surface-in 700ms var(--ease-standard) both',
        'fade-in': 'fade-in 240ms var(--ease-standard)',
        'detail-in': 'detail-in 320ms var(--ease-standard) both',
        spin: 'spin 900ms linear infinite',
      },
    },
  },
  plugins: [],
}