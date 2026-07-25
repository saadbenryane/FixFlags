import { gradeColorHex } from '@/lib/design/brand-spec'

/**
 * Shared SVG badge generator used by the badge API route and the roast tool.
 *
 * @param grade  Single-letter grade (A–F or '?')
 * @param score  Numeric score 0–100
 * @param displayHost  Hostname shown at the bottom of the badge
 * @param color  Brand hex color for the grade; defaults to `gradeColorHex(grade)`
 */
export function generateBadgeSvg(
  grade: string,
  score: number,
  displayHost: string,
  color?: string
): string {
  const hostname = displayHost.slice(0, 40)
  const fill = color ?? gradeColorHex(grade)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a"/>
      <stop offset="100%" style="stop-color:#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="320" height="180" rx="16" fill="url(#bg)"/>
  <rect x="1" y="1" width="318" height="178" rx="15" fill="none" stroke="${fill}" stroke-width="2" stroke-opacity="0.4"/>
  <text x="24" y="48" font-family="system-ui,-apple-system,sans-serif" font-size="13" font-weight="600" fill="${fill}" letter-spacing="0.5">FIXFLAGS</text>
  <text x="24" y="80" font-family="system-ui,-apple-system,sans-serif" font-size="24" font-weight="700" fill="white">Quality Grade</text>
  <text x="24" y="115" font-family="ui-monospace,monospace" font-size="48" font-weight="800" fill="${fill}">${grade}</text>
  <text x="82" y="115" font-family="system-ui,-apple-system,sans-serif" font-size="16" fill="#94a3b8">${score}/100</text>
  <text x="24" y="152" font-family="system-ui,-apple-system,sans-serif" font-size="12" fill="#64748b">${hostname}</text>
</svg>`
}

/**
 * Derive a display hostname from a URL string, falling back to the raw input.
 */
export function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
