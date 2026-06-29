import { checkExposedSecrets } from './exposed-secrets'
import { checkDependencyHygiene } from './dependency-hygiene'
import { checkDangerousPatterns } from './dangerous-patterns'
import type { CodeFinding, ScannedFile } from './types'

export * from './types'

export function runAllCodeChecks(files: ScannedFile[]): CodeFinding[] {
  return [
    ...checkExposedSecrets(files),
    ...checkDependencyHygiene(files),
    ...checkDangerousPatterns(files),
  ]
}
