// Single-file demo build (no Supabase env) used to publish a clickable preview.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist-artifact', assetsInlineLimit: 1e9, rollupOptions: { output: { inlineDynamicImports: true } } },
})
