import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // Sub-path when hosted under a folder (e.g. GitHub Pages: /buying-studio/).
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // *.local.test.ts run against real buying files that are never committed;
    // they only run when LOCAL_TESTS=1 is set.
    exclude: process.env.LOCAL_TESTS ? ['**/node_modules/**'] : ['**/node_modules/**', 'src/**/*.local.test.ts'],
  },
})
