/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { 900: '#111113', 700: '#3a3a40', 500: '#6b6b74', 400: '#8e8e97', 300: '#b9b9c0' },
        line: '#ececef',
        canvas: '#f6f6f7',
      },
      boxShadow: { card: '0 1px 2px rgba(16,16,20,0.04), 0 0 0 1px rgba(16,16,20,0.05)' },
    },
  },
  plugins: [],
}
