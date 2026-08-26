#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const mode = process.argv[2] ?? 'affected'
const workspaceRoot = process.cwd()

const tsLikeExtensions = new Set(['.ts', '.tsx'])
const testFilePattern = /(?:^|[./-])test\.[cm]?[jt]sx?$/

const scopes = {
  audit: {
    prefixes: ['lib/audit/'],
    test: ['npx', ['vitest', 'run', 'lib/audit/']],
  },
  queue: {
    prefixes: ['lib/queue/'],
    test: ['npx', ['vitest', 'run', 'lib/queue/']],
  },
  billing: {
    prefixes: ['lib/billing/'],
    test: ['npx', ['vitest', 'run', 'lib/billing/']],
  },
  graph: {
    prefixes: ['lib/graph/'],
    test: ['npx', ['vitest', 'run', 'lib/graph/']],
  },
  prompts: {
    prefixes: ['lib/prompts/'],
    test: ['npx', ['vitest', 'run', 'lib/prompts/']],
  },
  marketing: {
    prefixes: ['lib/marketing/'],
    test: ['npx', ['vitest', 'run', 'lib/marketing/']],
  },
  mcp: {
    prefixes: ['lib/mcp/', 'scripts/mcp-quality-gate.mjs'],
    test: ['npx', ['vitest', 'run', 'lib/mcp/']],
    gate: ['npm', ['run', 'mcp:quality-gate']],
  },
  components: {
    prefixes: ['components/'],
    test: ['npx', ['vitest', 'run', 'components/']],
  },
  app: {
    prefixes: ['app/'],
    test: ['npx', ['vitest', 'run', 'app/']],
  },
  api: {
    prefixes: ['app/api/', 'lib/api/'],
    test: ['npx', ['vitest', 'run', 'app/api/', 'lib/api/']],
  },
  prisma: {
    prefixes: ['prisma/'],
  },
  scripts: {
    prefixes: ['scripts/'],
  },
  worker: {
    prefixes: ['worker/'],
    test: ['npm', ['run', 'worker:test']],
  },
}

const fullValidationFiles = new Set([
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'next.config.ts',
  'tailwind.config.ts',
  'eslint.config.mjs',
  'vitest.config.ts',
  'scripts/validate.mjs',
])

const fullValidationPrefixes = ['.github/', 'prisma/']

const containerValidationFiles = new Set([
  '.dockerignore',
  'Dockerfile',
  'next.config.ts',
  'package.json',
  'package-lock.json',
  'railway.toml',
  'railway.worker.toml',
  'scripts/db-run.mjs',
  'scripts/runtime-start.mjs',
])

const docsOnlyExtensions = new Set(['.md', '.txt'])

const generatedPathPatterns = [
  /(^|\/)\.next(?:-[^/]*)?(\/|$)/,
  /(^|\/)\.cache(\/|$)/,
  /(^|\/)coverage(\/|$)/,
  /(^|\/)dist(\/|$)/,
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)output(\/|$)/,
  /(^|\/)playwright-report(\/|$)/,
  /(^|\/)test-results(\/|$)/,
]

export function isGeneratedPath(file) {
  return generatedPathPatterns.some((pattern) => pattern.test(file))
}

/** Normalize porcelain status lines and drop generated artifact paths. */
export function normalizeRepositoryState(porcelain) {
  return porcelain
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => {
      const pathPart = line.length >= 3 && line[2] === ' '
        ? line.slice(3)
        : line.replace(/^[ MADRCU?!]{1,2}\s+/, '')
      const filePath = pathPart.includes(' -> ')
        ? pathPart.split(' -> ').at(-1)
        : pathPart
      return filePath ? !isGeneratedPath(filePath) : true
    })
    .sort()
    .join('\n')
}

export function assertRepositoryUnchanged(initialPorcelain, currentPorcelain, commandLabel) {
  const before = normalizeRepositoryState(initialPorcelain)
  const after = normalizeRepositoryState(currentPorcelain)
  if (before === after) return
  const beforeSet = new Set(before ? before.split('\n') : [])
  const afterSet = new Set(after ? after.split('\n') : [])
  const added = [...afterSet].filter((line) => !beforeSet.has(line))
  const removed = [...beforeSet].filter((line) => !afterSet.has(line))
  const details = [
    ...removed.map((line) => `- ${line}`),
    ...added.map((line) => `+ ${line}`),
  ].join('\n')
  throw new Error(
    `Validation command "${commandLabel}" modified project files.\n${details || 'Repository state changed.'}`
  )
}

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: workspaceRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', options.ignoreErrors ? 'ignore' : 'pipe'],
  })
  if (result.status !== 0) {
    if (options.ignoreErrors) return ''
    const details = result.stderr?.trim() || `git ${args.join(' ')} failed`
    throw new Error(details)
  }
  return result.stdout
}

function changedFilesFromGit() {
  const base = process.env.VALIDATE_BASE
  const outputs = []

  if (base) {
    outputs.push(runGit(['diff', '--name-only', `${base}...HEAD`], { ignoreErrors: true }))
  }

  outputs.push(runGit(['diff', '--name-only'], { ignoreErrors: true }))
  outputs.push(runGit(['diff', '--name-only', '--cached'], { ignoreErrors: true }))
  outputs.push(runGit(['ls-files', '--others', '--exclude-standard'], { ignoreErrors: true }))

  return [...new Set(
    outputs
      .join('\n')
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)
      .filter((f) => !isGeneratedPath(f))
  )].sort()
}

function scopesForFile(file) {
  const matched = []
  for (const [name, config] of Object.entries(scopes)) {
    if (config.prefixes.some((p) => file.startsWith(p))) {
      matched.push(name)
    }
  }
  return matched
}

function isFullValidationFile(file) {
  return fullValidationFiles.has(file) ||
    containerValidationFiles.has(file) ||
    fullValidationPrefixes.some((p) => file.startsWith(p))
}

function withContainerValidation(commands, files) {
  if (!files.some((file) => containerValidationFiles.has(file))) return commands
  return [...commands, command('container:build', 'docker', ['build', '-t', 'fixflags:verify', '.'])]
}

function isDocsOnlyFile(file) {
  return docsOnlyExtensions.has(path.extname(file)) || file.startsWith('docs/') || file.startsWith('knowledge/')
}

function isLintableFile(file) {
  return tsLikeExtensions.has(path.extname(file))
}

function isTestRelevant(file, scopeNames) {
  if (testFilePattern.test(file)) return true
  if (scopeNames.length === 0) return false
  return scopeNames.some((name) => scopes[name]?.test)
}

function command(label, executable, args) {
  return { label, executable, args }
}

function scopeCommands(scopeNames, commandName) {
  const seen = new Set()
  const cmds = []
  for (const name of scopeNames.sort()) {
    const entry = scopes[name]?.[commandName]
    if (!entry) continue
    const key = `${commandName}:${name}`
    if (seen.has(key)) continue
    seen.add(key)
    const [executable, args] = entry
    cmds.push(command(key, executable, args))
  }
  return cmds
}

function changedLintCommand(files) {
  const lintable = files.filter((f) => isLintableFile(f) && existsSync(path.join(workspaceRoot, f)))
  if (lintable.length === 0) return []
  return [command('lint:changed', 'npx', [
    'eslint',
    '--cache',
    '--cache-location', '.cache/eslint/changed',
    ...lintable,
  ])]
}

export function fullCommands() {
  return [
    command('font:verify', 'npm', ['run', 'font:verify', '--', '--optional']),
    command('db:validate', 'npm', ['run', 'db:validate']),
    command('db:check', 'npm', ['run', 'db:check']),
    command('db:drift', 'npm', ['run', 'db:drift']),
    command('typecheck', 'npx', ['tsc', '--noEmit', '--incremental', 'false']),
    command('lint', 'npm', ['run', 'lint']),
    command('brand:hex-guard', 'npm', ['run', 'brand:hex-guard']),
    command('ui:drift-guard', 'npm', ['run', 'ui:drift-guard']),
    command('image:local-patterns-guard', 'npm', ['run', 'image:local-patterns-guard']),
    command('image:artwork-guard', 'npm', ['run', 'image:artwork-guard']),
    command('product:contract-guard', 'npm', ['run', 'product:contract-guard']),
    command('power-tools:visibility-guard', 'npm', ['run', 'power-tools:visibility-guard']),
    command('routes:contract-guard', 'npm', ['run', 'routes:contract-guard']),
    command('skills:validate', 'npm', ['run', 'skills:validate']),
    command('seo:guard', 'npm', ['run', 'seo:guard']),
    command('copy-drift-check', 'npm', ['run', 'copy-drift-check']),
    command('help:catalog-guard', 'npm', ['run', 'help:catalog-guard']),
    command('knowledge:duplication-guard', 'npm', ['run', 'knowledge:duplication-guard']),
    command('completeness:audit', 'npm', ['run', 'completeness:audit']),
    command('audit:capabilities', 'npm', ['run', 'audit:capabilities']),
    command('security:audit', 'npm', ['audit', '--audit-level=moderate']),
    command('test:scripts', 'npm', ['run', 'test:scripts']),
    command('test:unit', 'npm', ['run', 'test:unit']),
    command('test:coverage', 'npm', ['run', 'test:coverage']),
    command('accuracy:eval', 'npm', ['run', 'accuracy:eval']),
    command('build', 'node', ['scripts/next-build.mjs']),
    command('worker:build', 'npm', ['run', 'worker:build']),
  ]
}

export function releaseCommands() {
  const stages = [
    'foundation',
    'fixture-binding',
    'credentialed-core',
    'billing-open',
    'billing-closed',
    'external',
    'deployed',
  ]
  return [
    ...stages.map((stage) => command(`release:${stage}`, 'node', ['scripts/release-receipts.mjs', 'stage', stage])),
    command('release:final', 'node', ['scripts/release-receipts.mjs', 'final']),
  ]
}

export function buildPlan(requestedMode, providedFiles) {
  const files = (providedFiles ?? changedFilesFromGit()).filter((file) => !isGeneratedPath(file))
  const fullRequired = files.some(isFullValidationFile)
  const codeFiles = files.filter((f) => !isDocsOnlyFile(f))

  if (requestedMode === 'full') {
    return {
      files,
      commands: withContainerValidation(fullCommands(), files),
      reason: 'full validation requested',
    }
  }

  if (requestedMode === 'release') {
    return { files, commands: releaseCommands(), reason: 'release validation requested' }
  }

  if (requestedMode === 'lint-changed') {
    return { files, commands: changedLintCommand(files), reason: 'changed-file lint requested' }
  }

  if (requestedMode === 'typecheck') {
    return {
      files,
      commands: [command('typecheck', 'npx', ['tsc', '--noEmit', '--incremental', 'false'])],
      reason: 'typecheck requested',
    }
  }

  if (requestedMode !== 'quick' && requestedMode !== 'affected') {
    throw new Error(`Unknown validation mode: ${requestedMode}`)
  }

  if (files.length === 0 || codeFiles.length === 0) {
    return {
      files,
      commands: [],
      reason: files.length === 0 ? 'no changed files detected' : 'docs-only changes detected',
    }
  }

  if (fullRequired) {
    return {
      files,
      commands: withContainerValidation(fullCommands(), files),
      reason: 'shared validation config changed; using full validation',
    }
  }

  const commands = []
  const quick = requestedMode === 'quick'

  if (quick) {
    commands.push(...changedLintCommand(files))
    commands.push(command('typecheck', 'npx', ['tsc', '--noEmit', '--incremental', 'false']))
  } else {
    commands.push(command('typecheck', 'npx', ['tsc', '--noEmit', '--incremental', 'false']))
    commands.push(command('lint', 'npm', ['run', 'lint']))

    const testScopes = new Set()
    for (const file of files) {
      const fileScopes = scopesForFile(file)
      if (isTestRelevant(file, fileScopes)) {
        fileScopes.forEach((s) => testScopes.add(s))
      }
    }
    commands.push(...scopeCommands([...testScopes], 'test'))
    commands.push(...scopeCommands([...testScopes], 'gate'))

    commands.push(command('brand:hex-guard', 'npm', ['run', 'brand:hex-guard']))
    commands.push(command('ui:drift-guard', 'npm', ['run', 'ui:drift-guard']))
    commands.push(command('image:local-patterns-guard', 'npm', ['run', 'image:local-patterns-guard']))
    commands.push(command('image:artwork-guard', 'npm', ['run', 'image:artwork-guard']))
    commands.push(command('seo:guard', 'npm', ['run', 'seo:guard']))
    commands.push(command('copy-drift-check', 'npm', ['run', 'copy-drift-check']))
    commands.push(command('help:catalog-guard', 'npm', ['run', 'help:catalog-guard']))
  }

  return { files, commands, reason: `${requestedMode} validation for changed files` }
}

function printPlan(plan) {
  console.log(`Validation mode: ${mode}`)
  console.log(`Reason: ${plan.reason}`)
  console.log(`Changed files: ${plan.files.length === 0 ? 'none' : plan.files.length}`)

  if (plan.files.length > 0 && plan.files.length <= 30) {
    for (const file of plan.files) console.log(`  - ${file}`)
  } else if (plan.files.length > 30) {
    for (const file of plan.files.slice(0, 30)) console.log(`  - ${file}`)
    console.log(`  ... and ${plan.files.length - 30} more`)
  }

  if (plan.commands.length === 0) {
    console.log('Commands: none')
    return
  }

  console.log('Commands:')
  for (const item of plan.commands) {
    console.log(`  - ${item.label}: ${[item.executable, ...item.args].join(' ')}`)
  }
}

function runCommands(commands) {
  if (mode === 'release') {
    process.env.RELEASE_RUN_ID ??= `release-${Date.now()}`
  }
  const initialRepositoryState = runGit([
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ])

  for (const item of commands) {
    console.log(`\n$ ${[item.executable, ...item.args].join(' ')}`)
    const result = spawnSync(item.executable, item.args, {
      cwd: workspaceRoot,
      stdio: 'inherit',
      env: process.env,
    })
    if (result.status !== 0) {
      process.exit(result.status ?? 1)
    }

    const currentRepositoryState = runGit([
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
    ])
    assertRepositoryUnchanged(initialRepositoryState, currentRepositoryState, item.label)
  }
}

const isDirectExecution = Boolean(
  process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)

if (isDirectExecution) {
  try {
    const plan = buildPlan(mode)
    printPlan(plan)
    runCommands(plan.commands)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
