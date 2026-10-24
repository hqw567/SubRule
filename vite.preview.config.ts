import { defineConfig } from 'vite'

// Preview only the published files, without Start's SSR fallback.
export default defineConfig({
  build: { outDir: 'dist/client' },
  preview: { host: '127.0.0.1', port: 4319, strictPort: true },
})
