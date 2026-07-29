#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const CANONICAL = 'public/.well-known/skills/fixflags/SKILL.md'
const AGENTS_TARGET = '.agents/skills/fixflags/SKILL.md'
const CLAUDE_TARGET = '.claude/skills/fixflags/SKILL.md'

function insertAfterFrontmatter(source, text) {
  const match = source.match(/^(---[\s\S]*?---\n)/)
  if (match) {
    return match[1] + text + '\n' + source.slice(match[0].length)
  }
  return text + '\n' + source
}

function main() {
  const root = process.cwd()
  const canonicalPath = path.join(root, CANONICAL)

  if (!existsSync(canonicalPath)) {
    console.error(`ERROR: Canonical skill not found at ${CANONICAL}`)
    process.exit(1)
  }

  const source = readFileSync(canonicalPath, 'utf8')

  // Sync canonical to .agents/skills/fixflags/SKILL.md
  const agentsComment = `<!-- Auto-generated from ${CANONICAL}. Do not edit directly. Run \`npm run skills:sync\` to update. -->`
  const agentsPath = path.join(root, AGENTS_TARGET)
  mkdirSync(path.dirname(agentsPath), { recursive: true })
  writeFileSync(agentsPath, insertAfterFrontmatter(source, agentsComment))
  console.log(`  ${AGENTS_TARGET} ← ${CANONICAL}`)

  // Write deprecated pointer to .claude/skills/fixflags/SKILL.md
  const claudePath = path.join(root, CLAUDE_TARGET)
  mkdirSync(path.dirname(claudePath), { recursive: true })
  writeFileSync(claudePath, `> **Deprecated pointer.** The canonical FixFlags agent skill is at \`${CANONICAL}\`. Run \`npm run skills:sync\` to copy it here.\n`)
  console.log(`  ${CLAUDE_TARGET} ← deprecated pointer`)

  console.log('\nSkills synced.')
}

main()
