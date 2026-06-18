/** Map a 0–100 check score to a spectrum: red → brand orange → yellow → green. */
export function scoreToScanColor(score: number): string {
  const s = Math.min(100, Math.max(0, score))

  if (s < 40) {
    return 'hsl(var(--destructive))'
  }
  if (s < 58) {
    return 'hsl(var(--brand))'
  }
  if (s < 78) {
    return 'hsl(var(--warning))'
  }
  return 'hsl(var(--success))'
}

/** Color at the tip of the score ring arc (matches where the score lands on 0→100). */
export function scoreToRingTipColor(score: number): string {
  return scoreToScanColor(score)
}

export const CRITICAL_SCAN_THRESHOLD = 48

export function isCriticalScanScore(score: number): boolean {
  return score < CRITICAL_SCAN_THRESHOLD
}
