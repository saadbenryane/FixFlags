#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function markdownCells(line) {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|')) return []
  const body = trimmed.endsWith('|') ? trimmed.slice(1, -1) : trimmed.slice(1)
  const cells = []
  let current = ''
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index]
    if (character === '\\' && body[index + 1] === '|') {
      current += '|'
      index += 1
    } else if (character === '|') {
      cells.push(current.trim())
      current = ''
    } else {
      current += character
    }
  }
  cells.push(current.trim())
  return cells
}

function separatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

export function parseLegacyBoard(content) {
  const records = []
  const warnings = []
  for (const [index, line] of content.split('\n').entries()) {
    const cells = markdownCells(line)
    if (cells.length === 0 || separatorRow(cells) || cells[0] === 'Task ID') continue

    if (cells.length === 4) {
      const record = {
        taskId: cells[0],
        status: 'done',
        owner: cells[1],
        worktree: 'legacy',
        scope: cells[2],
        files: '',
        dependencies: 'Imported from the legacy Completed table.',
        updatedAt: cells[3],
        sourceLine: index + 1,
      }
      if (!record.taskId || !record.owner) warnings.push({ line: index + 1, message: 'Missing task id or owner.', raw: line })
      else records.push(record)
      if (!DATE_PATTERN.test(record.updatedAt)) warnings.push({ line: index + 1, message: `Invalid completed date: ${record.updatedAt || '(empty)'}.`, taskId: record.taskId })
      continue
    }
    if (cells.length < 8) {
      warnings.push({ line: index + 1, message: `Expected 4 or at least 8 cells; found ${cells.length}.`, raw: line })
      continue
    }

    // The legacy board occasionally contained an unescaped pipe in Dependencies.
    // The first six and final cells are stable, so fold extra middle cells back together.
    const record = {
      taskId: cells[0],
      status: cells[1],
      owner: cells[2],
      worktree: cells[3],
      scope: cells[4],
      files: cells[5],
      dependencies: cells.slice(6, -1).join(' | '),
      updatedAt: cells.at(-1),
      sourceLine: index + 1,
    }
    if (!record.taskId || !record.status || !record.owner) {
      warnings.push({ line: index + 1, message: 'Missing task id, status, or owner.', raw: line })
      continue
    }
    if (!DATE_PATTERN.test(record.updatedAt)) {
      warnings.push({ line: index + 1, message: `Invalid updated date: ${record.updatedAt || '(empty)'}.`, taskId: record.taskId })
    }
    records.push(record)
  }
  return { schemaVersion: 1, records, warnings }
}

export function readLegacyBoard(file) {
  if (!existsSync(file)) return { schemaVersion: 1, records: [], warnings: [{ line: 0, message: `Legacy board not found: ${file}` }] }
  return parseLegacyBoard(readFileSync(file, 'utf8'))
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  const requested = argv.find((arg) => !arg.startsWith('--'))
  const file = path.resolve(cwd, requested || '.agents/history/legacy-board-2026-10-09.md')
  const result = readLegacyBoard(file)
  const payload = { source: path.relative(cwd, file), ...result }
  console.log(JSON.stringify(payload, null, 2))
  return result.records.length > 0 ? 0 : 1
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect) process.exitCode = main()
