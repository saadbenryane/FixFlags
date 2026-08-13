import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const alias = {
  '@': path.resolve(__dirname, '.'),
}

// Force the test environment even when the shell exports NODE_ENV=development.
// Several billing gates (isDevUnlimitedScans) bypass plan enforcement in
// development, which would silently pass the tests that verify those gates.
const env = { NODE_ENV: 'test' as const }

export default defineConfig({
  test: {
    // Enforced by `npm run test:coverage` in the full local and CI gates.
    coverage: {
      provider: 'v8',
      include: ['lib/audit/**', 'lib/billing/**', 'lib/auth/**'],
      exclude: [
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/fixtures/**',
        '**/codemap.md',
        'lib/audit/accuracy-corpus.ts',
        'lib/audit/accuracy-browser-corpus.ts',
      ],
      reporter: ['text', 'text-summary'],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 60,
        branches: 45,
      },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'server',
          globals: false,
          environment: 'node',
          env,
          include: ['lib/**/*.test.ts', 'app/api/**/*.test.ts', 'worker/**/*.test.ts'],
          exclude: ['node_modules', '.next'],
          testTimeout: 30_000,
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'hooks',
          globals: false,
          environment: 'jsdom',
          env,
          include: ['hooks/**/*.test.ts'],
          exclude: ['node_modules', '.next'],
          testTimeout: 30_000,
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'ui',
          globals: false,
          environment: 'jsdom',
          env,
          include: ['components/**/__tests__/*.test.tsx'],
          exclude: ['node_modules', '.next'],
          setupFiles: ['./vitest.setup.ui.ts'],
          testTimeout: 30_000,
        },
      },
    ],
  },
})
