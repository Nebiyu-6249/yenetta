import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Only pure-logic tests run under Vitest; React Native screens are
    // smoke-tested via Expo tooling on a device/emulator.
    include: ['src/**/*.test.ts'],
  },
});
