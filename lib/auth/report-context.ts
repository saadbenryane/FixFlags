export function reportIdFromNextPath(next: string | null): string | null {
  if (!next) return null
  const match = /^\/report\/([^/?#]+)$/.exec(next)
  return match?.[1] ?? null
}
