import type { CodeFinding, ScannedFile } from './types'

const MAX_FINDINGS_PER_FILE = 5

interface DangerousPattern {
  category: string
  severity: CodeFinding['severity']
  pattern: RegExp
  problem: string
  fix: string
}

const DANGEROUS_PATTERNS: DangerousPattern[] = [
  {
    category: 'Dynamic code execution',
    severity: 'CRITICAL',
    pattern: /\beval\s*\(/,
    problem: 'Use of eval() executes arbitrary strings as code',
    fix: 'Replace eval() with a safe alternative (JSON.parse for data, a real parser/interpreter for logic) to avoid code-injection risk.',
  },
  {
    category: 'Shell command execution',
    severity: 'CRITICAL',
    // `execSync` has no legitimate non-shell meaning, so it's always flagged. Bare
    // `exec(` is only flagged when NOT preceded by a `.` - that excludes the extremely
    // common `someRegex.exec(str)` (RegExp.prototype.exec), which isn't shell execution
    // at all and would otherwise false-positive on nearly every regex-heavy file.
    pattern: /\bchild_process\b.*\b(exec|execSync)\s*\(|\bexecSync\s*\(|(?<!\.)\bexec\s*\(/,
    problem: 'Use of exec()/execSync() runs a shell command, which is risky if any part of the command includes unsanitized input',
    fix: 'Use execFile()/spawn() with an argument array instead of exec()/execSync() to avoid shell injection, and never interpolate user input into the command string.',
  },
  {
    category: 'Permissive CORS',
    severity: 'IMPORTANT',
    pattern: /Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*['"]/,
    problem: "Access-Control-Allow-Origin is hardcoded to '*'",
    fix: 'Restrict Access-Control-Allow-Origin to an explicit allow-list of trusted origins instead of wildcarding it, especially on routes that read credentials or cookies.',
  },
]

/** Flags risky code patterns (dynamic eval, shell exec, wildcard CORS) via regex heuristics. */
export function checkDangerousPatterns(files: ScannedFile[]): CodeFinding[] {
  const findings: CodeFinding[] = []

  for (const file of files) {
    let count = 0
    const lines = file.content.split('\n')

    outer: for (const { category, severity, pattern, problem, fix } of DANGEROUS_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        if (count >= MAX_FINDINGS_PER_FILE) break outer
        if (!pattern.test(lines[i])) continue
        count++
        findings.push({
          category,
          severity,
          filePath: file.path,
          lineStart: i + 1,
          lineEnd: i + 1,
          problem,
          evidence: lines[i].trim().slice(0, 300),
          fix,
        })
      }
    }
  }

  return findings
}
