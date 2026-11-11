/**
 * Weekly finding-quality review. A reviewer labels a sample of real Flags as useful, noisy or
 * wrong; the score reports precision overall and for fix-first Flags, and names the checks that
 * produce noise so they can be retuned. Precision here is a human judgment over a sample, not a
 * product claim.
 */
export const QUALITY_LABELS = ['useful', 'noisy', 'wrong'] as const

export const QUALITY_COLUMNS = ['flag_id', 'checked_at', 'host', 'page', 'check_id', 'severity', 'priority_band', 'problem', 'label', 'note'] as const
export type QualityRow = Record<(typeof QUALITY_COLUMNS)[number], string>

/** Hosts that are our own fixtures or examples, never customer evidence. */
export function isReviewableHost(host: string): boolean {
  const name = host.toLowerCase()
  return !(name === 'localhost' || name.endsWith('.localhost') || name.endsWith('.test') || name.endsWith('.example')
    || name.endsWith('.invalid') || name === 'example.com' || /^\d+\.\d+\.\d+\.\d+$/.test(name))
}

/** Spread the sample across checks so one large check cannot dominate it. */
export function sampleAcrossChecks<T extends { auditId: string }>(flags: readonly T[], count: number): T[] {
  const byAudit = new Map<string, T[]>()
  for (const flag of flags) byAudit.set(flag.auditId, [...(byAudit.get(flag.auditId) ?? []), flag])
  const queues = [...byAudit.values()]
  const picked: T[] = []
  for (let round = 0; picked.length < count; round++) {
    let added = false
    for (const queue of queues) {
      if (picked.length >= count) break
      if (queue[round]) { picked.push(queue[round]); added = true }
    }
    if (!added) break
  }
  return picked
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export function toQualityCsv(rows: readonly QualityRow[]): string {
  return [QUALITY_COLUMNS.join(','), ...rows.map(row => QUALITY_COLUMNS.map(column => csvCell(row[column] ?? '')).join(','))].join('\n') + '\n'
}

export function parseQualityCsv(text: string): QualityRow[] {
  const records: string[][] = []
  let field = '', record: string[] = [], quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index++ }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { record.push(field); field = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++
      record.push(field); records.push(record); record = []; field = ''
    } else field += char
  }
  if (field || record.length) { record.push(field); records.push(record) }
  const [header, ...body] = records.filter(row => row.some(cell => cell.trim()))
  if (!header) return []
  return body.map(cells => Object.fromEntries(QUALITY_COLUMNS.map(column => [column, cells[header.indexOf(column)]?.trim() ?? ''])) as QualityRow)
}

export type QualityScore = {
  labeled: number
  unlabeled: number
  precision: number | null
  fixFirst: { labeled: number; precision: number | null }
  meetsTarget: boolean | null
  noisiestChecks: { checkId: string; noisy: number; wrong: number; labeled: number }[]
}

export const FIX_FIRST_PRECISION_TARGET = 0.9

export function scoreQualityReview(rows: readonly QualityRow[]): QualityScore {
  const labeled = rows.filter(row => (QUALITY_LABELS as readonly string[]).includes(row.label.toLowerCase()))
  const useful = (list: readonly QualityRow[]) => list.filter(row => row.label.toLowerCase() === 'useful').length
  const ratio = (list: readonly QualityRow[]) => list.length ? useful(list) / list.length : null
  const fixFirst = labeled.filter(row => row.priority_band === 'fix_first')
  const byCheck = new Map<string, { noisy: number; wrong: number; labeled: number }>()
  for (const row of labeled) {
    const entry = byCheck.get(row.check_id) ?? { noisy: 0, wrong: 0, labeled: 0 }
    entry.labeled++
    if (row.label.toLowerCase() === 'noisy') entry.noisy++
    if (row.label.toLowerCase() === 'wrong') entry.wrong++
    byCheck.set(row.check_id, entry)
  }
  const fixFirstPrecision = ratio(fixFirst)
  return {
    labeled: labeled.length,
    unlabeled: rows.length - labeled.length,
    precision: ratio(labeled),
    fixFirst: { labeled: fixFirst.length, precision: fixFirstPrecision },
    meetsTarget: fixFirstPrecision === null ? null : fixFirstPrecision >= FIX_FIRST_PRECISION_TARGET,
    noisiestChecks: [...byCheck.entries()].map(([checkId, entry]) => ({ checkId, ...entry }))
      .filter(entry => entry.noisy + entry.wrong > 0)
      .sort((a, b) => (b.noisy + b.wrong) - (a.noisy + a.wrong) || a.checkId.localeCompare(b.checkId))
      .slice(0, 10),
  }
}
