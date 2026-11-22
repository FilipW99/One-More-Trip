import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works from any static host or sub-path (e.g. GitHub Pages).
  base: './',
  server: { port: 5173, host: true },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
