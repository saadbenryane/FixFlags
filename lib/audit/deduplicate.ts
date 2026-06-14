import { createHash } from 'node:crypto'
import type { DeterministicFinding } from '@/lib/audit/checks'
import type { JudgeOutput } from '@/lib/audit/judge'

function normalizedWords(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2)
  )
}

function similarity(a: string, b: string): number {
  const left = normalizedWords(a)
  const right = normalizedWords(b)
  if (left.size === 0 || right.size === 0) return 0
  let intersection = 0
  for (const word of left) {
    if (right.has(word)) intersection++
  }
  return intersection / (left.size + right.size - intersection)
}

export function findingFingerprint(input: {
  checkId?: string | null
  pageUrl?: string | null
  area: string
  problem: string
}): string {
  const identity = input.checkId
    ? `check:${input.checkId}`
    : `problem:${[...normalizedWords(input.problem)].sort().join(' ')}`
  return createHash('sha256')
    .update(`${input.area}|${input.pageUrl ?? 'primary'}|${identity}`)
    .digest('hex')
}

export function deduplicateFindings(
  deterministic: DeterministicFinding[],
  aiFindings: JudgeOutput['newFindings']
): JudgeOutput['newFindings'] {
  const accepted: JudgeOutput['newFindings'] = []

  for (const candidate of aiFindings) {
    const duplicatesDeterministic = deterministic.some(
      (finding) =>
        finding.area === candidate.area &&
        (similarity(finding.problem, candidate.problem) >= 0.55 ||
          similarity(
            `${finding.problem} ${finding.evidence}`,
            `${candidate.problem} ${candidate.evidence}`
          ) >= 0.62)
    )
    if (duplicatesDeterministic) continue

    const duplicatesAi = accepted.some(
      (finding) =>
        finding.area === candidate.area &&
        similarity(
          `${finding.problem} ${finding.evidence}`,
          `${candidate.problem} ${candidate.evidence}`
        ) >= 0.72
    )
    if (!duplicatesAi) accepted.push(candidate)
  }

  return accepted
}
