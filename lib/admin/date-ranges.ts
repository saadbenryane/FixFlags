const reportingZone = 'Africa/Casablanca'
/** Midnight in the operator reporting timezone. Storage and returned bounds are UTC instants. */
export function startOf(daysAgo: number, now = new Date()): Date {
  const calendar = new Intl.DateTimeFormat('en-CA', {
    timeZone: reportingZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (name: string) => Number(calendar.find((p) => p.type === name)!.value)
  const target = Date.UTC(part('year'), part('month') - 1, part('day') - daysAgo)
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone: reportingZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  let guess = target
  for (let n = 0; n < 3; n++) {
    const pieces = format.formatToParts(new Date(guess)),
      get = (name: string) => Number(pieces.find((p) => p.type === name)!.value)
    const observed = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    )
    guess += target - observed
  }
  return new Date(guess)
}
export function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0
}
