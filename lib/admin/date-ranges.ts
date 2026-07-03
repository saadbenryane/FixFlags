/** Midnight N days ago, for admin dashboard period filters. */
export function startOf(daysAgo: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d
}

/** Percentage of value/total, rounded, 0 when total is 0. */
export function pct(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0
}
