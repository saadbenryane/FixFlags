/**
 * Detects whether a set of images represents a customer/partner logo wall.
 * A logo wall is 4+ images whose alt text looks like brand names (e.g.
 * "Notion", "Y Combinator") or contains the word "logo".
 */
export function hasLogoWall(images: Array<{ alt: string | null }>): boolean {
  const brandLike = images.filter((img) => {
    const alt = (img.alt ?? '').trim()
    if (/logo/i.test(alt)) return true
    // 1-3 capitalized words, brand-length (e.g. "Notion", "Y Combinator")
    return /^[A-Z][A-Za-z0-9.&' ]{1,24}$/.test(alt) && alt.split(/\s+/).length <= 3 && alt.length >= 2
  }).length
  return brandLike >= 4
}

/**
 * Deduplicates repeated text patterns in headings. For example, responsive
 * layouts sometimes render the same H1 twice ("ABAB" -> "AB"). Detects
 * chunk repetition (2-4x) and returns the first occurrence.
 */
export function normalizeHeadingText(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed.length < 24) return collapsed
  const compact = collapsed.replace(/\s+/g, '')
  for (let parts = 2; parts <= 4; parts++) {
    const chunkLen = Math.floor(compact.length / parts)
    if (chunkLen < 12) continue
    const chunk = compact.slice(0, chunkLen)
    if (chunk.repeat(parts) === compact) {
      const spaced = collapsed.slice(0, Math.floor(collapsed.length / parts)).trim()
      return spaced || collapsed
    }
  }
  return collapsed
}
