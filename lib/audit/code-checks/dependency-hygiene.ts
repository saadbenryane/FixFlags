import type { CodeFinding, ScannedFile } from './types'

const LOCKFILE_NAMES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']

/** Flags missing lockfiles and unpinned dependency versions in package.json. */
export function checkDependencyHygiene(files: ScannedFile[]): CodeFinding[] {
  const findings: CodeFinding[] = []
  const paths = new Set(files.map((f) => f.path))

  const manifests = files.filter((f) => f.path === 'package.json' || f.path.endsWith('/package.json'))

  for (const manifest of manifests) {
    const dir = manifest.path.includes('/') ? manifest.path.slice(0, manifest.path.lastIndexOf('/') + 1) : ''
    const hasLockfile = LOCKFILE_NAMES.some((name) => paths.has(`${dir}${name}`))
    if (!hasLockfile) {
      findings.push({
        category: 'Dependency hygiene',
        severity: 'IMPORTANT',
        filePath: manifest.path,
        problem: 'No lockfile (package-lock.json, yarn.lock, or pnpm-lock.yaml) found alongside package.json',
        evidence: manifest.path,
        fix: 'Commit a lockfile so dependency versions are reproducible across installs and CI runs.',
      })
    }

    let parsed: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
    try {
      parsed = JSON.parse(manifest.content)
    } catch {
      continue
    }

    const allDeps = { ...parsed.dependencies, ...parsed.devDependencies }
    const lines = manifest.content.split('\n')
    for (const [name, version] of Object.entries(allDeps)) {
      if (version !== '*' && version !== 'latest') continue
      const lineIndex = lines.findIndex((line) => line.includes(`"${name}"`) && line.includes(version))
      findings.push({
        category: 'Dependency hygiene',
        severity: 'IMPORTANT',
        filePath: manifest.path,
        lineStart: lineIndex >= 0 ? lineIndex + 1 : undefined,
        lineEnd: lineIndex >= 0 ? lineIndex + 1 : undefined,
        problem: `Dependency "${name}" is unpinned (version "${version}")`,
        evidence: lineIndex >= 0 ? lines[lineIndex].trim() : `"${name}": "${version}"`,
        fix: `Pin "${name}" to a specific version or range instead of "${version}" to avoid unreviewed breaking changes on install.`,
      })
    }
  }

  return findings
}
