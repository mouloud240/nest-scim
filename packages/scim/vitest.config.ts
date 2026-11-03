import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.e2e_spec.ts'],
    // reflect-metadata must be the FIRST thing loaded: every Nest
    // decorator, and this library's own, run on that polyfill.
    setupFiles: ['./vitest.setup.ts'],
  },
});
