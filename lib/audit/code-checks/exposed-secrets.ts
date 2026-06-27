import { SECRET_PATTERNS, scrubSecrets } from '@/lib/security/secret-scrub'
import type { CodeFinding, ScannedFile } from './types'

const MAX_FINDINGS_PER_FILE = 5

/** Flags committed credentials. Evidence is scrubbed before it ever reaches the DB. */
export function checkExposedSecrets(files: ScannedFile[]): CodeFinding[] {
  const findings: CodeFinding[] = []

  for (const file of files) {
    let count = 0
    const lines = file.content.split('\n')

    outer: for (const { category, pattern } of SECRET_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        if (count >= MAX_FINDINGS_PER_FILE) break outer
        pattern.lastIndex = 0
        if (!pattern.test(lines[i])) continue
        count++
        findings.push({
          category: 'Exposed secret',
          severity: 'CRITICAL',
          filePath: file.path,
          lineStart: i + 1,
          lineEnd: i + 1,
          problem: `Possible ${category} committed to the repository`,
          evidence: scrubSecrets(lines[i]).text.trim().slice(0, 300),
          fix: `Remove the credential from ${file.path}:${i + 1}, rotate it immediately (treat it as compromised once it has been pushed to git history), and load it from an environment variable or secret manager instead.`,
        })
      }
    }
  }

  return findings
}
