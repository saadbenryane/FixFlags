const EVIDENCE_DATE_TIME = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
  hourCycle: 'h12',
})

/**
 * Format persisted evidence with one explicit locale and time zone.
 *
 * Client components are pre-rendered on the server before they hydrate in the
 * browser. Using the host's implicit locale or time zone makes the same instant
 * render as different text in those two environments and React replaces the
 * evidence line after load.
 */
export function formatEvidenceTimestamp(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  // ICU punctuation differs between engines, even with an explicit locale.
  // Safari inserts "at" where Node inserts a comma, which breaks hydration.
  const parts = EVIDENCE_DATE_TIME.formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)!.value
  return `${part('month')} ${part('day')}, ${part('year')}, ${part('hour')}:${part('minute')} ${part('dayPeriod')} UTC`
}
