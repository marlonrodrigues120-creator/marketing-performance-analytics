/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Geist', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] },
      colors: {
        brand: { 50: '#eef1ff', 100: '#dfe5ff', 200: '#c3cdff', 300: '#9aabff', 400: '#6c82fe', 500: '#3b5bfd', 600: '#2a44e0', 700: '#2236b4', 800: '#1e2f8e', 900: '#1c2b70' },
        navy: { 700: '#1a2346', 800: '#121a38', 900: '#0d1430', 950: '#090e22' },
        ai: { 50: '#f3f1fd', 100: '#e4e0fb', 200: '#c9c2f5', 300: '#a99ef0', 400: '#9085e9', 500: '#6250d6', 600: '#4f3fc0', 700: '#41339f', 800: '#332880', 900: '#271f63' },
        good: { DEFAULT: '#0ca30c', ink: '#006300' },
        bad: { DEFAULT: '#d03b3b' },
        warn: { DEFAULT: '#fab219' },
      },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)' },
      keyframes: { fadeUp: { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'none' } } },
      animation: { 'fade-up': 'fadeUp .35s ease-out both' },
    },
  },
  plugins: [],
}
