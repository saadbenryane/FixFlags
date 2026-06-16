/** Normalize a URL or hostname to a canonical domain key (lowercase, no www). */
export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://${trimmed}`)
    let host = url.hostname.toLowerCase()
    if (host.startsWith('www.')) host = host.slice(4)
    if (!host || host.includes(' ')) return null
    return host
  } catch {
    return null
  }
}
