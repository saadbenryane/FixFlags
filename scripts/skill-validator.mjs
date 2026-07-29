#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const SKILLS_ROOT = '.cursor/skills'
const AGENT_SKILLS_ROOT = '.agents/skills'
const CUSTOMER_SKILLS_ROOT = 'public/.well-known/skills'
const DEPRECATED_SKILLS_ROOT = '.opencode/skills'
const IDE_INTEGRATIONS_ROOT = 'ide-integrations'
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

// Canonical MCP tool names from lib/mcp/tool-manifest.ts
// Non-deprecated tools that must appear in the canonical skill
const MCP_TOOLS = [
  'ff_check_and_plan',
  'ff_get_check_status',
  'ff_get_report',
  'ff_get_rubric',
  'ff_get_flag',
  'ff_plan_mode_prompt',
  'ff_get_product_context',
  'ff_get_all_fixes',
  'ff_get_current_finish_plan',
  'ff_recheck_and_compare',
  'ff_compare',
  'generate-fix-prompt',
  'ff_list_recent_audits',
  'ff_start_repo_scan',
  'ff_list_repo_scans',
  'ff_get_repo_scan',
  'ff_get_repo_finding',
  'ff_mark_fix_attempted',
]

// Skill files that must mention ff_mark_fix_attempted
const SKILL_FILES_REQUIRING_MARK = [
  'public/.well-known/skills/fixflags/SKILL.md',
  'ide-integrations/cursor/fixflags.mdc',
  'ide-integrations/claude-code/fixflags-skill.md',
  'ide-integrations/kiro/fixflags-power.md',
  'ide-integrations/opencode/opencode-skill.md',
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
  const skillsRoot = path.join(root, SKILLS_ROOT)
  const agentSkillsRoot = path.join(root, AGENT_SKILLS_ROOT)
  const customerSkillsRoot = path.join(root, CUSTOMER_SKILLS_ROOT)
  const ideRoot = path.join(root, IDE_INTEGRATIONS_ROOT)
  const errors = []

  // === Canonical customer skill must exist ===
  const canonicalPath = path.join(customerSkillsRoot, 'fixflags', 'SKILL.md')
  if (!existsSync(canonicalPath)) {
    errors.push(`${CUSTOMER_SKILLS_ROOT}/fixflags/SKILL.md: canonical customer skill is missing`)
  }

  // === Basic structure checks on all skill directories ===
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
      /fixflags check/,
      /ff_check_and_plan/,
      /fixflags recheck/,
      /ff_recheck_and_compare/,
      /Fixed, Remaining, New, and Regressed/,
    ]) {
      if (!required.test(customerSkill)) {
        errors.push(`${path.relative(root, canonicalPath)}: missing customer workflow contract ${required}`)
      }
    }

    // Check MCP tool coverage: every canonical tool must appear in the canonical skill
    for (const tool of MCP_TOOLS) {
      if (!customerSkill.includes(tool)) {
        errors.push(`${path.relative(root, canonicalPath)}: missing MCP tool "${tool}"`)
      }
    }

    // Check "before deploy" section exists (before you ship / before shipping)
    if (!/before you ship/i.test(customerSkill) && !/before shipping/i.test(customerSkill)) {
      errors.push(`${path.relative(root, canonicalPath)}: missing "before you ship" or "before shipping" guidance`)
    }

    // Check "suggest Watch" section exists
    if (!/suggest.*[Ww]atch/i.test(customerSkill) && !/enable Watch/i.test(customerSkill)) {
      errors.push(`${path.relative(root, canonicalPath)}: missing "suggest Watch" or "enable Watch" guidance`)
    }
  }

  // === Deprecated pointer validation for .opencode/skills ===
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

      // Check ff_get_current_finish_plan is marked deprecated when present
      if (source.includes('ff_get_current_finish_plan') && !/(deprecated|Deprecated)/i.test(source)) {
        errors.push(`${path.relative(root, file)}: ff_get_current_finish_plan must be marked deprecated`)
      }
    }

    // Check ff_mark_fix_attempted appears in required skill files
    for (const relPath of SKILL_FILES_REQUIRING_MARK) {
      const fullPath = path.join(root, relPath)
      if (existsSync(fullPath)) {
        const source = readFileSync(fullPath, 'utf8')
        if (!source.includes('ff_mark_fix_attempted')) {
          errors.push(`${relPath}: missing ff_mark_fix_attempted tool`)
        }
      }
    }
  }

  // === Validate .agents/skills/fixflags/SKILL.md references canonical location ===
  const agentSkillPath = path.join(agentSkillsRoot, 'fixflags', 'SKILL.md')
  if (existsSync(agentSkillPath)) {
    const agentSkill = readFileSync(agentSkillPath, 'utf8')
    if (!agentSkill.includes('.well-known/skills/fixflags/SKILL.md')) {
      errors.push(`${AGENT_SKILLS_ROOT}/fixflags/SKILL.md: must reference canonical .well-known location`)
    }
  }

  // === Validate .claude/skills/fixflags/SKILL.md is a deprecated pointer ===
  const claudeSkillPath = path.join(root, '.claude/skills/fixflags/SKILL.md')
  if (existsSync(claudeSkillPath)) {
    const claudeSkill = readFileSync(claudeSkillPath, 'utf8')
    if (!/deprecated pointer/i.test(claudeSkill)) {
      errors.push(`.claude/skills/fixflags/SKILL.md: must be a deprecated pointer to canonical`)
    }
    const substantiveLines = claudeSkill.split('\n').filter((line) => line.trim() && !line.startsWith('#') && !line.startsWith('>'))
    if (substantiveLines.length > 3) {
      errors.push(`.claude/skills/fixflags/SKILL.md: deprecated pointer must be minimal (has ${substantiveLines.length} substantive lines)`)
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
