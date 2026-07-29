import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { API_BASE } from './credentials.js'

export const EDITORS = ['cursor', 'claude', 'windsurf', 'codex'] as const
export type Editor = (typeof EDITORS)[number]

interface InitOptions {
  cwd?: string
  editor?: Editor | 'all'
  dryRun?: boolean
  scope?: 'project' | 'user'
  productUrl?: string
}

interface PlannedWrite {
  path: string
  content: string
}

function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, content, 'utf8')
  renameSync(temporary, path)
}

function parseJsonConfig(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {}
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('expected an object')
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    throw new Error(
      `Cannot merge malformed configuration at ${path}: ${(error as Error).message}`
    )
  }
}

function mergeMcpJson(path: string, server: Record<string, unknown>): string {
  const config = parseJsonConfig(path)
  const existing =
    config.mcpServers && typeof config.mcpServers === 'object'
      ? (config.mcpServers as Record<string, unknown>)
      : {}
  return `${JSON.stringify(
    { ...config, mcpServers: { ...existing, fixflags: server } },
    null,
    2
  )}\n`
}

function replaceManagedBlock(source: string, block: string): string {
  const start = '# BEGIN FIXFLAGS MANAGED'
  const end = '# END FIXFLAGS MANAGED'
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}\\n?`, 'm')
  const next = `${start}\n${block.trim()}\n${end}\n`
  if (pattern.test(source)) return source.replace(pattern, next)
  return `${source.trimEnd()}${source.trim() ? '\n\n' : ''}${next}`
}

function detectedEditors(cwd: string): Editor[] {
  const found: Editor[] = []
  if (existsSync(join(cwd, '.cursor'))) found.push('cursor')
  if (existsSync(join(cwd, '.claude'))) found.push('claude')
  if (existsSync(join(cwd, '.windsurf'))) found.push('windsurf')
  if (existsSync(join(cwd, '.agents')) || existsSync(join(cwd, 'AGENTS.md'))) {
    found.push('codex')
  }
  return found.length ? found : ['codex']
}

function cursorRule(skill: string): string {
  const body = skill.replace(/^---[\s\S]*?---\s*/m, '')
  return `---
description: Check, fix, deploy, and Re-check a product with FixFlags
alwaysApply: false
---

${body.trim()}
`
}

export async function initializeFixFlags(options: InitOptions = {}) {
  const cwd = options.cwd ?? process.cwd()
  const scope = options.scope ?? 'project'
  const skillUrl = `${API_BASE}/.well-known/skills/fixflags/SKILL.md`
  const response = await fetch(skillUrl)
  if (!response.ok) {
    throw new Error(`Could not download the FixFlags skill (${response.status}).`)
  }
  const skill = await response.text()
  if (!skill.startsWith('---\n') || !skill.includes('\nname: fixflags\n')) {
    throw new Error('The downloaded FixFlags skill is invalid.')
  }

  const editors =
    options.editor === 'all'
      ? [...EDITORS]
      : options.editor
        ? [options.editor]
        : detectedEditors(cwd)
  const writes: PlannedWrite[] = []

  for (const editor of editors) {
    if (editor === 'cursor') {
      const skillPath =
        scope === 'user'
          ? join(homedir(), '.cursor', 'rules', 'fixflags.mdc')
          : join(cwd, '.cursor', 'rules', 'fixflags.mdc')
      const mcpPath =
        scope === 'user'
          ? join(homedir(), '.cursor', 'mcp.json')
          : join(cwd, '.cursor', 'mcp.json')
      writes.push({ path: skillPath, content: cursorRule(skill) })
      writes.push({
        path: mcpPath,
        content: mergeMcpJson(mcpPath, {
          command: 'fixflags',
          args: ['mcp'],
          env: { FIXFLAGS_API_URL: API_BASE },
        }),
      })
      continue
    }

    if (editor === 'claude') {
      const root = scope === 'user' ? join(homedir(), '.claude') : join(cwd, '.claude')
      const mcpPath = scope === 'user' ? join(root, 'mcp.json') : join(cwd, '.mcp.json')
      writes.push({ path: join(root, 'skills', 'fixflags', 'SKILL.md'), content: skill })
      writes.push({
        path: mcpPath,
        content: mergeMcpJson(mcpPath, {
          command: 'fixflags',
          args: ['mcp'],
          env: { FIXFLAGS_API_URL: API_BASE },
        }),
      })
      continue
    }

    if (editor === 'codex') {
      const skillRoot =
        scope === 'user' ? join(homedir(), '.codex', 'skills') : join(cwd, '.agents', 'skills')
      const configPath =
        scope === 'user'
          ? join(homedir(), '.codex', 'config.toml')
          : join(cwd, '.codex', 'config.toml')
      const existing = existsSync(configPath) ? readFileSync(configPath, 'utf8') : ''
      writes.push({ path: join(skillRoot, 'fixflags', 'SKILL.md'), content: skill })
      writes.push({
        path: configPath,
        content: replaceManagedBlock(
          existing,
          `[mcp_servers.fixflags]\ncommand = "fixflags"\nargs = ["mcp"]\nenv = { FIXFLAGS_API_URL = "${API_BASE}" }`
        ),
      })
      continue
    }

    if (editor === 'windsurf') {
      const root =
        scope === 'user'
          ? join(homedir(), '.codeium', 'windsurf')
          : join(cwd, '.windsurf')
      const mcpPath = join(root, 'mcp_config.json')
      writes.push({ path: join(root, 'skills', 'fixflags', 'SKILL.md'), content: skill })
      writes.push({
        path: mcpPath,
        content: mergeMcpJson(mcpPath, {
          command: 'fixflags',
          args: ['mcp'],
          env: { FIXFLAGS_API_URL: API_BASE },
        }),
      })
      continue
    }
  }

  if (options.productUrl) {
    let productUrl: URL
    try {
      productUrl = new URL(options.productUrl)
    } catch {
      throw new Error('The product URL must be a complete http or https URL.')
    }
    if (!['http:', 'https:'].includes(productUrl.protocol)) {
      throw new Error('The product URL must use http or https.')
    }
    writes.push({
      path: join(cwd, '.fixflags', 'config.json'),
      content: `${JSON.stringify(
        { productUrl: productUrl.toString(), editors },
        null,
        2
      )}\n`,
    })
  }

  if (!options.dryRun) {
    for (const write of writes) atomicWrite(write.path, write.content)
  }
  return {
    editors,
    dryRun: Boolean(options.dryRun),
    files: writes.map((write) => relative(cwd, write.path) || write.path),
    skillUrl,
  }
}
