type SignalForJudgment = {
  kind: string
  name: string
  route: string | null
  sessionHash: string | null
  numericValue: number | null
  release: { externalId: string } | null
}

export type SynthesizedSignalContext = {
  truthClass: 'OBSERVED'
  kind: 'ERROR_PATTERN' | 'OUTCOME_PATTERN' | 'PERFORMANCE_PATTERN'
  summary: string
  count: number
  release: string | null
}

/** Product Signals remain observations; this function never confirms causality or creates Flags. */
export function synthesizeProductSignals(
  signals: SignalForJudgment[]
): SynthesizedSignalContext[] {
  const context: SynthesizedSignalContext[] = []
  const errors = new Map<string, SignalForJudgment[]>()
  const outcomes = new Map<string, { success: SignalForJudgment[]; failure: SignalForJudgment[] }>()
  const performance = new Map<string, SignalForJudgment[]>()

  for (const signal of signals) {
    if (signal.kind === 'ERROR') {
      const key = `${signal.name}|${signal.route ?? ''}|${signal.release?.externalId ?? ''}`
      errors.set(key, [...(errors.get(key) ?? []), signal])
    } else if (signal.kind === 'OUTCOME') {
      const match = signal.name.match(/^(.*):(success|failure)$/)
      if (!match) continue
      const name = match[1]
      const status = match[2] as 'success' | 'failure'
      const bucket = outcomes.get(name) ?? { success: [], failure: [] }
      bucket[status].push(signal)
      outcomes.set(name, bucket)
    } else if (signal.kind === 'PERFORMANCE' && signal.numericValue !== null) {
      performance.set(signal.name, [...(performance.get(signal.name) ?? []), signal])
    }
  }

  for (const group of errors.values()) {
    if (group.length < 3) continue
    const sample = group[0]
    const sessions = new Set(group.flatMap((signal) => signal.sessionHash ?? [])).size
    const where = sample.route ? ` on ${sample.route}` : ''
    const release = sample.release?.externalId ?? null
    const afterRelease = release ? ` after release ${release}` : ''
    context.push({
      truthClass: 'OBSERVED',
      kind: 'ERROR_PATTERN',
      summary: `${sample.name} was observed ${group.length} times across ${sessions || 1} anonymous sessions${where}${afterRelease}.`,
      count: group.length,
      release,
    })
  }

  for (const [name, group] of outcomes) {
    if (group.failure.length < 3 || group.failure.length < group.success.length) continue
    const release = group.failure[0]?.release?.externalId ?? null
    context.push({
      truthClass: 'OBSERVED',
      kind: 'OUTCOME_PATTERN',
      summary: `${name} recorded ${group.failure.length} failures and ${group.success.length} successes${release ? ` on release ${release}` : ''}.`,
      count: group.failure.length,
      release,
    })
  }

  for (const [name, group] of performance) {
    if (group.length < 5) continue
    const average = group.reduce((sum, signal) => sum + (signal.numericValue ?? 0), 0) / group.length
    const unhealthy = (name === 'LCP' && average > 2_500) || (name === 'INP' && average > 200) || (name === 'CLS' && average > 0.1)
    if (!unhealthy) continue
    context.push({
      truthClass: 'OBSERVED',
      kind: 'PERFORMANCE_PATTERN',
      summary: `${name} averaged ${average.toFixed(name === 'CLS' ? 2 : 0)} across ${group.length} observations.`,
      count: group.length,
      release: group[0]?.release?.externalId ?? null,
    })
  }

  return context.sort((left, right) => right.count - left.count).slice(0, 5)
}
