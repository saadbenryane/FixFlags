#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const CANONICAL = 'public/.well-known/skills/fixflags/SKILL.md'
const CLI_TARGET = 'fixflags-cli/SKILL.md'

function main() {
  const root = process.cwd()
  const canonicalPath = path.join(root, CANONICAL)

  if (!existsSync(canonicalPath)) {
    console.error(`ERROR: Canonical skill not found at ${CANONICAL}`)
    process.exit(1)
  }

  const source = readFileSync(canonicalPath, 'utf8')

  // Package the public customer workflow with the CLI. Internal coding-agent
  // instructions live in AGENTS.md and are intentionally not mirrored here.
  const cliPath = path.join(root, CLI_TARGET)
  writeFileSync(cliPath, source)
  console.log(`  ${CLI_TARGET} ← ${CANONICAL}`)

  console.log('\nCustomer skill synced.')
}

main()
