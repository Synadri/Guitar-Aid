import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { alphaTab } from '@coderline/alphatab-vite';

export default defineConfig({
  base: './',
  plugins: [react(), alphaTab()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@coderline/alphatab'],
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@coderline/alphatab')) {
            return 'alphatab';
          }
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
        },
      },
    },
  },
  test: {
    // Por defecto los tests corren en node. Los que necesiten DOM (Testing Library, desde U1)
    // lo piden con el comentario `// @vitest-environment jsdom` al inicio del archivo.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
