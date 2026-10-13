export function adminDate(value: Date | string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Casablanca',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Not recorded'
}
