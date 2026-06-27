export interface ScannedFile {
  /** Path relative to the repo root, using forward slashes. */
  path: string
  content: string
}

export interface CodeFinding {
  category: string
  severity: 'CRITICAL' | 'IMPORTANT' | 'POLISH'
  filePath: string
  lineStart?: number
  lineEnd?: number
  problem: string
  evidence: string
  fix: string
}
