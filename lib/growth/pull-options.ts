export interface GrowthPullOptions {
  days?: number
  excludeCountries?: string[]
}

export const DEFAULT_GROWTH_PULL_DAYS = 28

export function resolveGrowthPullDays(options?: GrowthPullOptions): number {
  return options?.days ?? DEFAULT_GROWTH_PULL_DAYS
}

export function growthArtifactSegment(options?: GrowthPullOptions): string {
  const days = resolveGrowthPullDays(options)
  const excluded = options?.excludeCountries?.filter(Boolean) ?? []
  if (days === DEFAULT_GROWTH_PULL_DAYS && excluded.length === 0) return 'rolling-28d'
  const base = `rolling-${days}d`
  if (excluded.length === 0) return base
  return `${base}-excl-${excluded.map((country) => country.toLowerCase().replace(/\s+/g, '-')).join('-')}`
}

export function parseGrowthPullCliArgs(argv: string[]): GrowthPullOptions {
  const options: GrowthPullOptions = {}
  for (const arg of argv) {
    if (arg.startsWith('--days=')) {
      const days = Number(arg.slice('--days='.length))
      if (!Number.isFinite(days) || days < 1) throw new Error(`Invalid --days value: ${arg}`)
      options.days = Math.floor(days)
      continue
    }
    if (arg.startsWith('--exclude-country=')) {
      const country = arg.slice('--exclude-country='.length).trim()
      if (!country) throw new Error(`Invalid --exclude-country value: ${arg}`)
      options.excludeCountries = [...(options.excludeCountries ?? []), country]
    }
  }
  return options
}
