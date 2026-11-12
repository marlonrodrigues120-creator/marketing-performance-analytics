/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] },
      colors: {
        brand: { 50: '#eef5fd', 100: '#cde2fb', 200: '#9ec5f4', 300: '#6da7ec', 400: '#3987e5', 500: '#2a78d6', 600: '#1c5cab', 700: '#184f95', 800: '#104281', 900: '#0d366b' },
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
