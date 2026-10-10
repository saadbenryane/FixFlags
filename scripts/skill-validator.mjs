#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const CUSTOMER_SKILLS_ROOT = 'public/.well-known/skills'
const IDE_INTEGRATIONS_ROOT = 'ide-integrations'
const CLI_SKILL = 'fixflags-cli/SKILL.md'
const MAX_SKILL_LINES = 260
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

function collectMcpTools(root) {
  const registry = JSON.parse(readFileSync(path.join(root, 'lib/mcp/tool-registry.json'), 'utf8'))
  return Object.values(registry.tools).map((tool) => tool.name)
}

const LAUNCH_MCP_TOOLS = [
  'fixflags.list_sites',
  'fixflags.list_outcomes',
  'fixflags.run',
  'fixflags.get_run',
  'fixflags.list_flags',
  'fixflags.get_flag',
  'fixflags.record_fix',
  'fixflags.verify_flag',
  'fixflags.get_connection_info',
]

function markdownFiles(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry)
    if (statSync(absolute).isDirectory()) markdownFiles(absolute, files)
    else if (entry.endsWith('.md') || entry.endsWith('.mdc')) files.push(absolute)
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
  const customerSkillsRoot = path.join(root, CUSTOMER_SKILLS_ROOT)
  const ideRoot = path.join(root, IDE_INTEGRATIONS_ROOT)
  const errors = []
  const MCP_TOOLS = collectMcpTools(root)

  // === Canonical customer skill must exist ===
  const canonicalPath = path.join(customerSkillsRoot, 'fixflags', 'SKILL.md')
  if (!existsSync(canonicalPath)) {
    errors.push(`${CUSTOMER_SKILLS_ROOT}/fixflags/SKILL.md: canonical customer skill is missing`)
  }

  // === Basic structure checks on the public customer skill ===
  const roots = [customerSkillsRoot].filter(existsSync)
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

  // === Link validation ===
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

  // === Canonical skill workflow contract checks ===
  if (existsSync(canonicalPath)) {
    const customerSkill = readFileSync(canonicalPath, 'utf8')
    for (const required of [
      /Site → Outcomes that matter → Clear or Flag/,
      /Request independent verification/,
      /Poll the run/,
      /Inspect the Flag/,
      /Verify recovery/,
      /No Flag does not mean stale or untested behavior is Clear/,
      /Do not call legacy report, Finish Plan, repository scan, or report Agent tools/,
      ...LAUNCH_MCP_TOOLS.map((tool) => new RegExp(tool)),
    ]) {
      if (!required.test(customerSkill)) {
        errors.push(`${path.relative(root, canonicalPath)}: missing customer workflow contract ${required}`)
      }
    }
  }

  // === Validate IDE integration files ===
  if (existsSync(ideRoot)) {
    // Collect all skill-like files in ide-integrations (non-directory files + immediate children)
    const ideFiles = markdownFiles(ideRoot)

    for (const file of ideFiles) {
      const source = readFileSync(file, 'utf8')

      // Check for made-up tool names (tools that look like ff_* but aren't in canonical list)
      // Skip "there is no" and "does not exist" statements that reference known-non-existent tools
      const lines = source.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const matches = lines[i].matchAll(/`ff_[a-z_]+`/g)
        for (const match of matches) {
          const toolName = match[0].slice(1, -1)
          if (!MCP_TOOLS.includes(toolName)) {
            // Skip lines that explicitly say the tool doesn't exist (strip markdown formatting)
            const plainLine = lines[i].replace(/[*_`]/g, '')
            if (/there is no/i.test(plainLine) || /does not exist/i.test(plainLine)) continue
            errors.push(`${path.relative(root, file)}: references unknown tool "${toolName}"`)
          }
        }
      }

    }

    // Installed editor instructions must only advertise the launch tool set.
    for (const relPath of [
      'ide-integrations/cursor/fixflags.mdc',
      'ide-integrations/claude-code/fixflags-skill.md',
      'ide-integrations/kiro/fixflags-power.md',
      'ide-integrations/opencode/opencode-skill.md',
    ]) {
      const fullPath = path.join(root, relPath)
      if (existsSync(fullPath)) {
        const source = readFileSync(fullPath, 'utf8')
        if (!source.includes('fixflags.run') || !source.includes('fixflags.verify_flag')) {
          errors.push(`${relPath}: missing Outcome verification workflow`)
        }
        for (const tool of source.matchAll(/`(fixflags\.[a-z_]+)`/g)) {
          if (!LAUNCH_MCP_TOOLS.includes(tool[1])) {
            errors.push(`${relPath}: advertises retired tool ${tool[1]}`)
          }
        }
      }
    }
  }

  // The unpublished CLI candidate carries the canonical customer skill so
  // editor setup can be tested while public MCP discovery remains withheld.
  const cliSkillPath = path.join(root, CLI_SKILL)
  if (!existsSync(cliSkillPath)) {
    errors.push(`${CLI_SKILL}: bundled customer skill is missing`)
  } else if (
    existsSync(canonicalPath) &&
    readFileSync(cliSkillPath, 'utf8') !== readFileSync(canonicalPath, 'utf8')
  ) {
    errors.push(`${CLI_SKILL}: must exactly match ${CUSTOMER_SKILLS_ROOT}/fixflags/SKILL.md`)
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
    console.log('Customer skill and IDE integration validation passed.')
  }
}
