import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: 'e2e-llm-stub',
    watch: false,
    environment: 'node',
    include: ['fixtures/**/*.spec.ts'],
    reporters: ['default'],
  },
});
