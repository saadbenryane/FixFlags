#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const SKILLS_ROOT = '.cursor/skills'
const AGENT_SKILLS_ROOT = '.agents/skills'
const CUSTOMER_SKILLS_ROOT = 'public/.well-known/skills'
const DEPRECATED_SKILLS_ROOT = '.opencode/skills'
const MAX_SKILL_LINES = 180
const STALE = [
  /AGENTS\.md Project facts/i,
  /fixflags-design-philosophy/,
  /fixflags-ui-upgrade/,
]
const VOLATILE_FACT = [
  /\b\d[\d,]*\s+(?:unit\s+)?tests?\s+pass/i,
  /\b\d+\s+(?:API\s+)?routes?\b/i,
  /\b\d+\s+(?:MCP\s+)?tools?\b/i,
  /\b\d+\s+deterministic check modules?\b/i,
]

function markdownFiles(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry)
    if (statSync(absolute).isDirectory()) markdownFiles(absolute, files)
    else if (entry.endsWith('.md')) files.push(absolute)
  }
  return files
}

function frontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) return null
  return Object.fromEntries(match[1].split('\n').map((line) => {
    const separator = line.indexOf(':')
    return separator < 0 ? [line.trim(), ''] : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
  }))
}

export function validateSkills(root = process.cwd()) {
  const skillsRoot = path.join(root, SKILLS_ROOT)
  const agentSkillsRoot = path.join(root, AGENT_SKILLS_ROOT)
  const customerSkillsRoot = path.join(root, CUSTOMER_SKILLS_ROOT)
  const errors = []
  if (!existsSync(path.join(customerSkillsRoot, 'fixflags', 'SKILL.md'))) {
    errors.push(`${CUSTOMER_SKILLS_ROOT}/fixflags/SKILL.md: canonical customer skill is missing`)
  }
  const roots = [skillsRoot, agentSkillsRoot, customerSkillsRoot].filter(existsSync)
  const directories = roots.flatMap((currentRoot) =>
    readdirSync(currentRoot)
      .filter((entry) => {
        const directory = path.join(currentRoot, entry)
        return statSync(directory).isDirectory() && existsSync(path.join(directory, 'SKILL.md'))
      })
      .map((entry) => ({ currentRoot, name: entry }))
  )

  for (const { currentRoot, name } of directories) {
    const directory = path.join(currentRoot, name)
    const skillFile = path.join(directory, 'SKILL.md')
    const source = readFileSync(skillFile, 'utf8')
    const meta = frontmatter(source)
    if (!meta?.name || !meta?.description) errors.push(`${path.relative(root, skillFile)}: frontmatter requires name and description`)
    if (meta?.name !== name) errors.push(`${path.relative(root, skillFile)}: name must match directory (${name})`)
    if (source.split('\n').length > MAX_SKILL_LINES) errors.push(`${path.relative(root, skillFile)}: exceeds ${MAX_SKILL_LINES} lines`)

    for (const pattern of [...STALE, ...VOLATILE_FACT]) {
      if (pattern.test(source)) errors.push(`${path.relative(root, skillFile)}: contains stale or volatile fact ${pattern}`)
    }
  }

  for (const file of roots.flatMap((currentRoot) => markdownFiles(currentRoot))) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0]
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue
      const absolute = path.resolve(path.dirname(file), target)
      if (!existsSync(absolute)) errors.push(`${path.relative(root, file)}: broken link ${match[1]}`)
      if (target.includes('references/') && target.split('/').filter(Boolean).length > 2) {
        errors.push(`${path.relative(root, file)}: reference depth exceeds one level (${target})`)
      }
    }
  }

  const customerSkillFile = path.join(customerSkillsRoot, 'fixflags', 'SKILL.md')
  if (existsSync(customerSkillFile)) {
    const customerSkill = readFileSync(customerSkillFile, 'utf8')
    for (const required of [
      /fixflags check/,
      /ff_check_and_plan/,
      /fixflags recheck/,
      /ff_recheck_and_compare/,
      /Fixed, Remaining, New, and Regressed/,
    ]) {
      if (!required.test(customerSkill)) {
        errors.push(`${path.relative(root, customerSkillFile)}: missing customer workflow contract ${required}`)
      }
    }
  }

  const deprecatedRoot = path.join(root, DEPRECATED_SKILLS_ROOT)
  if (existsSync(deprecatedRoot)) {
    for (const file of markdownFiles(deprecatedRoot)) {
      if (path.basename(file) === 'README.md') continue
      const source = readFileSync(file, 'utf8')
      const substantiveLines = source.split('\n').filter((line) => line.trim() && !line.startsWith('#'))
      if (!/deprecated pointer/i.test(source) || substantiveLines.length > 1) {
        errors.push(`${path.relative(root, file)}: deprecated mirror must be a fact-free canonical pointer`)
      }
    }
  }

  return errors
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect) {
  const errors = validateSkills()
  if (errors.length) {
    console.error('Skill validation failed:\n')
    for (const error of errors) console.error(`  ${error}`)
    process.exitCode = 1
  } else {
    console.log('Skill validation passed.')
  }
}
