#!/usr/bin/env node

import { rm } from 'node:fs/promises'
import { build } from 'esbuild'

await rm('dist', { recursive: true, force: true })

await build({
  entryPoints: ['worker/index.ts'],
  outfile: 'dist/worker/index.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  packages: 'external',
  sourcemap: true,
  tsconfig: 'tsconfig.json',
  logLevel: 'info',
})

await build({
  entryPoints: ['worker/check-parser.ts'], outfile: 'dist/worker/check-parser.js', bundle: true,
  platform: 'node', format: 'cjs', target: 'node22', packages: 'external', sourcemap: true,
  tsconfig: 'tsconfig.json', logLevel: 'info',
})
