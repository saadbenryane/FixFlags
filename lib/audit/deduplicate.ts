import { createHash } from 'node:crypto'
import type { DeterministicFlag } from '@/lib/audit/checks'
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

export function flagFingerprint(input: {
  checkId?: string | null
  pageUrl?: string | null
  rubric: string
  problem: string
}): string {
  const identity = input.checkId
    ? `check:${input.checkId}`
    : `problem:${[...normalizedWords(input.problem)].sort().join(' ')}`
  return createHash('sha256')
    .update(`${input.rubric}|${input.pageUrl ?? 'primary'}|${identity}`)
    .digest('hex')
}

export function deduplicateFlags(
  deterministic: DeterministicFlag[],
  aiFlags: JudgeOutput['newFlags']
): JudgeOutput['newFlags'] {
  const accepted: JudgeOutput['newFlags'] = []

  for (const candidate of aiFlags) {
    const duplicatesDeterministic = deterministic.some(
      (flag) =>
        flag.rubric === candidate.rubric &&
        (similarity(flag.problem, candidate.problem) >= 0.55 ||
          similarity(
            `${flag.problem} ${flag.evidence}`,
            `${candidate.problem} ${candidate.evidence}`
          ) >= 0.62)
    )
    if (duplicatesDeterministic) continue

    const duplicatesAi = accepted.some(
      (flag) =>
        flag.rubric === candidate.rubric &&
        similarity(
          `${flag.problem} ${flag.evidence}`,
          `${candidate.problem} ${candidate.evidence}`
        ) >= 0.72
    )
    if (!duplicatesAi) accepted.push(candidate)
  }

  return accepted
}
