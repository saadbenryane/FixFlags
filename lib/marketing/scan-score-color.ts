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

/** Grade → HSL color string, sourced from the shared grade CSS variables. */
export const GRADE_HSL: Record<string, string> = {
  A: 'hsl(var(--grade-A))',
  B: 'hsl(var(--grade-B))',
  C: 'hsl(var(--grade-C))',
  D: 'hsl(var(--grade-D))',
  F: 'hsl(var(--grade-F))',
}

export function gradeHsl(grade: string): string {
  return GRADE_HSL[grade] ?? 'hsl(var(--muted-foreground))'
}

export const CRITICAL_SCAN_THRESHOLD = 48

export function isCriticalScanScore(score: number): boolean {
  return score < CRITICAL_SCAN_THRESHOLD
}
