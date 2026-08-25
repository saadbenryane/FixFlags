export function envPriceId(key: string): string | undefined {
  const value = process.env[key]
  return value && value.length > 0 ? value : undefined
}

export function envPriceIds(key: string): string[] {
  return (process.env[key] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function envPriceUsd(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw || raw.length === 0) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
