import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    // Por defecto los tests corren en node. Los que necesiten DOM (Testing Library, desde U1)
    // lo piden con el comentario `// @vitest-environment jsdom` al inicio del archivo.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
