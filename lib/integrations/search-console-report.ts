import { z } from 'zod'
import { readBoundedJson } from '@/lib/http/read-json'
import { GoogleProviderError } from './google-response'

const pacificDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric',
})

/** Dates in Search Console requests are calendar dates in Pacific time. */
export function searchConsoleReportingPeriod(now = new Date()) {
  const parts = Object.fromEntries(pacificDate.formatToParts(now).map(part => [part.type, Number(part.value)]))
  const end = Date.UTC(parts.year, parts.month - 1, parts.day - 1)
  const start = end - 27 * 86_400_000
  return { startDate: new Date(start).toISOString().slice(0, 10), endDate: new Date(end).toISOString().slice(0, 10) }
}

const count = z.number().int().nonnegative().max(2_147_483_647)
const position = z.number().finite().nonnegative()
const keys = z.array(z.string().min(1).max(8192)).max(8)
export const searchConsoleContextRow = z.object({ keys, clicks: count.optional(), impressions: count.optional(), position: position.optional() })
export const searchConsolePerformanceRow = z.object({ keys, clicks: count, impressions: count, position, ctr: z.number().min(0).max(1) })
const reportSchema = z.object({
  rows: z.array(z.unknown()).optional(),
  responseAggregationType: z.enum(['auto', 'byPage', 'byProperty']).optional(),
  metadata: z.object({ first_incomplete_date: z.string().optional(), first_incomplete_hour: z.string().optional() }).optional(),
})

/** Keep provider report identity and dimensions intact before a row can
 * become current context or a search recommendation. */
export async function readSearchConsoleRows<T extends { keys: string[] }>(response: Response, rowSchema: z.ZodType<T>,
  input: { dimensionCount: number; limit: number; pageScoped: boolean }): Promise<T[]> {
  const report = reportSchema.safeParse(await readBoundedJson(response, 1_000_000).catch(() => null))
  if (!report.success || report.data.metadata?.first_incomplete_date || report.data.metadata?.first_incomplete_hour ||
    input.pageScoped && report.data.responseAggregationType === 'byProperty' || (report.data.rows?.length ?? 0) > input.limit)
    throw new GoogleProviderError('MALFORMED_PROVIDER_RESPONSE')
  const seen = new Set<string>()
  return (report.data.rows ?? []).map(raw => {
    const row = rowSchema.safeParse(raw)
    if (!row.success || row.data.keys.length !== input.dimensionCount) throw new GoogleProviderError('MALFORMED_PROVIDER_RESPONSE')
    const identity = JSON.stringify(row.data.keys)
    if (seen.has(identity)) throw new GoogleProviderError('MALFORMED_PROVIDER_RESPONSE')
    seen.add(identity)
    return row.data
  })
}
