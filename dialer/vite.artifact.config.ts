// Single-file demo build (no Supabase env) used to publish a clickable preview.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Keep the preview in demo mode even though .env.production holds the live values.
  define: { 'import.meta.env.VITE_SUPABASE_URL': 'undefined', 'import.meta.env.VITE_SUPABASE_ANON_KEY': 'undefined' },
  build: { outDir: 'dist-artifact', assetsInlineLimit: 1e9, rollupOptions: { output: { inlineDynamicImports: true } } },
})
