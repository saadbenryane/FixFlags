#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js']
const CORE_ROUTE_ADAPTERS = new Set([
  'app/api/flags/[id]/attempts/route.ts',
  'app/api/flags/[id]/feedback/route.ts',
  'app/api/products/[id]/signals/route.ts',
  'app/api/projects/[id]/watch/route.ts',
  'app/api/reports/[id]/re-check/route.ts',
])
const REMOVED_CANVAS_ROUTES = [
  'app/api/reports/[id]/canvases/route.ts',
  'app/api/reports/[id]/canvases/[canvasId]/route.ts',
  'app/api/reports/[id]/canvases/[canvasId]/versions/route.ts',
]
const DATABASE_IMPORT = /(?:@\/lib\/db|@prisma\/client)/

function walk(directory, files = []) {
  if (!existsSync(directory)) return files
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue
    const absolute = path.join(directory, entry)
    if (statSync(absolute).isDirectory()) walk(absolute, files)
    else if (SOURCE_EXTENSIONS.includes(path.extname(entry))) files.push(absolute)
  }
  return files
}

function runtimeImports(source) {
  const imports = []
  const pattern = /import\s+(?!type\b)(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g
  for (const match of source.matchAll(pattern)) imports.push(match[1])
  return imports
}

function resolveLocalImport(fromFile, specifier, sources) {
  let base
  if (specifier.startsWith('@/')) base = specifier.slice(2)
  else if (specifier.startsWith('.')) {
    base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier))
  } else return null

  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => `${base}/index${extension}`),
  ]
  return candidates.find((candidate) => Object.hasOwn(sources, candidate)) ?? null
}

function dependencyCycles(sources) {
  const graph = new Map()
  for (const [file, source] of Object.entries(sources)) {
    graph.set(
      file,
      runtimeImports(source)
        .map((specifier) => resolveLocalImport(file, specifier, sources))
        .filter(Boolean)
    )
  }

  const cycles = new Set()
  const visiting = new Set()
  const visited = new Set()
  const stack = []

  function visit(file) {
    if (visiting.has(file)) {
      const start = stack.indexOf(file)
      const cycle = [...stack.slice(start), file]
      const members = cycle.slice(0, -1)
      const canonicalStart = members.reduce(
        (best, member, index) => member < members[best] ? index : best,
        0
      )
      const canonical = [
        ...members.slice(canonicalStart),
        ...members.slice(0, canonicalStart),
        members[canonicalStart],
      ]
      cycles.add(canonical.join(' -> '))
      return
    }
    if (visited.has(file)) return
    visiting.add(file)
    stack.push(file)
    for (const dependency of graph.get(file) ?? []) visit(dependency)
    stack.pop()
    visiting.delete(file)
    visited.add(file)
  }

  for (const file of graph.keys()) visit(file)
  return [...cycles].sort()
}

export function moduleBoundaryFailures({ sources, existingFiles = new Set() }) {
  const failures = []

  for (const [file, source] of Object.entries(sources)) {
    const imports = runtimeImports(source)
    if (/^\s*['"]use client['"]/.test(source)) {
      for (const specifier of imports) {
        if (DATABASE_IMPORT.test(specifier)) {
          failures.push(`${file} is a client module importing server database code (${specifier})`)
        }
      }
    }
    if (CORE_ROUTE_ADAPTERS.has(file)) {
      for (const specifier of imports) {
        if (DATABASE_IMPORT.test(specifier)) {
          failures.push(`${file} bypasses its application boundary (${specifier})`)
        }
      }
    }
  }

  for (const route of REMOVED_CANVAS_ROUTES) {
    if (existingFiles.has(route)) failures.push(`${route} reintroduces the parked Canvas API`)
  }

  for (const cycle of dependencyCycles(sources)) {
    failures.push(`runtime dependency cycle: ${cycle}`)
  }
  return failures
}

export function runModuleBoundaryGuard(root = process.cwd()) {
  const roots = ['app', 'components', 'hooks', 'lib']
  const absoluteFiles = roots.flatMap((directory) => walk(path.join(root, directory)))
  const sources = Object.fromEntries(
    absoluteFiles.map((file) => [
      path.relative(root, file).split(path.sep).join('/'),
      readFileSync(file, 'utf8'),
    ])
  )
  return moduleBoundaryFailures({
    sources,
    existingFiles: new Set(Object.keys(sources)),
  })
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect) {
  const failures = runModuleBoundaryGuard()
  if (failures.length > 0) {
    console.error('Module boundary guard failed:\n')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exitCode = 1
  } else {
    console.log('Module boundary guard passed: client/server, route/application, parked API, and cycle contracts are clean.')
  }
}
