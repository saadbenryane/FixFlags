/**
 * Lightweight singular/plural formatter for customer-facing counts.
 * Returns `${count} ${word}` with the correct plural form.
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const noun = count === 1 ? singular : plural ?? `${singular}s`
  return `${count} ${noun}`
}
