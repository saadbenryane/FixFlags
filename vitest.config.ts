import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    // Force the test environment even when the shell exports NODE_ENV=development.
    // Several billing gates (isDevUnlimitedScans) bypass plan enforcement in
    // development, which would silently pass the tests that verify those gates.
    env: { NODE_ENV: 'test' },
    include: ['lib/**/*.test.ts', 'app/api/**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
