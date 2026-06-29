import { describe, it, expect } from 'vitest'
import { checkDangerousPatterns } from '../dangerous-patterns'
import { checkExposedSecrets } from '../exposed-secrets'
import { checkDependencyHygiene } from '../dependency-hygiene'
import { runAllCodeChecks } from '../index'
import type { ScannedFile } from '../types'

function file(path: string, content: string): ScannedFile {
  return { path, content }
}

describe('checkDangerousPatterns', () => {
  it('flags eval and shell exec as critical, wildcard CORS as important', () => {
    const findings = checkDangerousPatterns([
      file('a.js', 'const x = eval(userInput)'),
      file('b.js', "child_process.execSync('rm -rf ' + dir)"),
      file('c.js', "res.setHeader('Access-Control-Allow-Origin', '*')"),
    ])
    const byCategory = Object.fromEntries(findings.map((f) => [f.category, f]))
    expect(byCategory['Dynamic code execution'].severity).toBe('CRITICAL')
    expect(byCategory['Shell command execution'].severity).toBe('CRITICAL')
    expect(byCategory['Permissive CORS'].severity).toBe('IMPORTANT')
    expect(byCategory['Dynamic code execution'].lineStart).toBe(1)
  })

  it('returns nothing for clean code', () => {
    expect(checkDangerousPatterns([file('a.js', 'const x = JSON.parse(input)')])).toEqual([])
  })

  it('caps findings per file', () => {
    const content = Array.from({ length: 10 }, () => 'eval(x)').join('\n')
    const findings = checkDangerousPatterns([file('a.js', content)])
    expect(findings.length).toBeLessThanOrEqual(5)
  })
})

describe('checkExposedSecrets', () => {
  it('flags a committed AWS key and scrubs the evidence', () => {
    const findings = checkExposedSecrets([
      file('config.js', 'const key = "AKIAIOSFODNN7EXAMPLE"'),
    ])
    expect(findings).toHaveLength(1)
    expect(findings[0].severity).toBe('CRITICAL')
    expect(findings[0].category).toBe('Exposed secret')
    expect(findings[0].evidence).not.toContain('AKIAIOSFODNN7EXAMPLE')
  })

  it('ignores files without secrets', () => {
    expect(checkExposedSecrets([file('a.js', 'const port = 3000')])).toEqual([])
  })
})

describe('checkDependencyHygiene', () => {
  it('flags a missing lockfile', () => {
    const findings = checkDependencyHygiene([
      file('package.json', JSON.stringify({ dependencies: { left: '1.0.0' } })),
    ])
    expect(findings.some((f) => f.problem.includes('No lockfile'))).toBe(true)
  })

  it('does not flag a lockfile that is present', () => {
    const findings = checkDependencyHygiene([
      file('package.json', JSON.stringify({ dependencies: { left: '1.0.0' } })),
      file('package-lock.json', '{}'),
    ])
    expect(findings.some((f) => f.problem.includes('No lockfile'))).toBe(false)
  })

  it('flags unpinned dependency versions', () => {
    const findings = checkDependencyHygiene([
      file('package.json', JSON.stringify({ dependencies: { foo: '*', bar: 'latest' } })),
      file('package-lock.json', '{}'),
    ])
    const unpinned = findings.filter((f) => f.problem.includes('unpinned'))
    expect(unpinned).toHaveLength(2)
  })

  it('ignores malformed package.json without throwing', () => {
    expect(() =>
      checkDependencyHygiene([
        file('package.json', '{ not valid json'),
        file('package-lock.json', '{}'),
      ])
    ).not.toThrow()
  })
})

describe('runAllCodeChecks', () => {
  it('aggregates findings from every check module', () => {
    const findings = runAllCodeChecks([
      file('a.js', 'eval(x)'),
      file('config.js', 'const key = "AKIAIOSFODNN7EXAMPLE"'),
      file('package.json', JSON.stringify({ dependencies: { left: '1.0.0' } })),
    ])
    const categories = new Set(findings.map((f) => f.category))
    expect(categories.has('Dynamic code execution')).toBe(true)
    expect(categories.has('Exposed secret')).toBe(true)
    expect(categories.has('Dependency hygiene')).toBe(true)
  })
})
