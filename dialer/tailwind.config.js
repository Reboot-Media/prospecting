/** @type {import('tailwindcss').Config} */
// Calm palette: warm stone neutrals, one muted violet accent (a quiet nod to the
// Reboot purple), and soft status tones. Nothing saturated.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { 900: '#1c1b19', 700: '#45433e', 500: '#75726b', 400: '#9b988f', 300: '#c6c3bb' },
        line: '#e8e6e1',
        canvas: '#ecebe7',
        panel: '#fafaf8',
        wash: '#f4f3f0',
        accent: { 50: '#f5f4fa', 100: '#ebe9f5', 200: '#d6d2ec', 400: '#9a93cf', 500: '#7b73bd', 600: '#625aa6', 700: '#4f4887' },
        sage: { 50: '#eef3ef', 400: '#8fb19a', 600: '#4d7a5c', 700: '#3e6249' },
        sand: { 50: '#f6f1e6', 400: '#d0b17a', 600: '#8f6d33', 700: '#76592a' },
        clay: { 50: '#f7ece8', 400: '#d39a8a', 600: '#a2533f', 700: '#874434' },
        mist: { 50: '#edf1f5', 400: '#93a9c0', 600: '#4f6a85', 700: '#40576e' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,27,25,0.04), 0 0 0 1px rgba(28,27,25,0.06)',
        panel: '0 1px 3px rgba(28,27,25,0.05), 0 8px 24px -12px rgba(28,27,25,0.10)',
      },
    },
  },
  plugins: [],
}
