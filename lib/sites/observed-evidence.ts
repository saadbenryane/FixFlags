export type ObservedPage = {
  url: string
  label: string
  note: string
  valueLabel: string | null
  /** Share of the strongest recorded value, from 0 to 1. Null when pages are not one measurement. */
  share: number | null
}

export type ObservedEvidence =
  | { kind: 'text'; text: string }
  | {
      kind: 'pages'
      summary: string | null
      trailing: string | null
      pages: ObservedPage[]
    }

const PAGE_URL = /https?:\/\/[^\s]+(?=:\s)/g
const TRAILING_COUNT = /\s+(Observed on \d+ pages?\.)\s*$/
const METRIC = /^(.*?)(\d+(?:\.\d+)?)(s|ms)$/

function pageLabel(url: string): string {
  try {
    const parsed = new URL(url)
    const path = `${parsed.pathname}${parsed.search}`
    return path === '/' ? parsed.host : path
  } catch {
    return url
  }
}

/** Turn a repeated "url: measurement" record into one finding and a page list. */
export function presentObservedEvidence(text: string): ObservedEvidence {
  const matches = [...text.matchAll(PAGE_URL)]
  if (matches.length < 2) return { kind: 'text', text }

  const pages = matches.map((match, index) => {
    const url = match[0]
    const start = (match.index ?? 0) + url.length
    const end = index + 1 < matches.length ? matches[index + 1].index ?? text.length : text.length
    return { url, note: text.slice(start, end).replace(/^:\s*/, '').trim() }
  })

  let trailing: string | null = null
  const last = pages[pages.length - 1]
  const counted = last.note.match(TRAILING_COUNT)
  if (counted?.[1]) {
    trailing = counted[1]
    last.note = last.note.replace(TRAILING_COUNT, '').trim()
  }

  const metrics = pages.map(page => {
    const metric = page.note.match(METRIC)
    return metric ? { label: metric[1].trim(), raw: metric[2], value: Number(metric[2]), unit: metric[3] } : null
  })
  const shared = metrics.every(metric => metric && metric.label === metrics[0]?.label && metric.unit === metrics[0]?.unit)
    ? metrics[0]
    : null

  const ranked = pages.map((page, index) => {
    const metric = metrics[index]
    return {
      url: page.url,
      label: pageLabel(page.url),
      note: page.note,
      valueLabel: shared && metric ? `${metric.raw}${metric.unit}` : null,
      value: metric?.value ?? null,
    }
  })
  if (shared) ranked.sort((left, right) => (right.value ?? 0) - (left.value ?? 0) || left.label.localeCompare(right.label))

  const peak = shared ? Math.max(...ranked.map(page => page.value ?? 0)) : 0
  const presented: ObservedPage[] = ranked.map(page => ({
    url: page.url,
    label: page.label,
    note: page.note,
    valueLabel: page.valueLabel,
    share: shared && page.value != null && peak > 0 ? page.value / peak : null,
  }))

  const values = shared ? metrics.flatMap(metric => metric ? [metric] : []) : []
  const lowest = values.reduce((best, metric) => metric.value < best.value ? metric : best, values[0])
  const highest = values.reduce((best, metric) => metric.value > best.value ? metric : best, values[0])
  const summary = shared && lowest && highest && lowest.value !== highest.value
    ? `${shared.label} ${lowest.raw}${shared.unit} to ${highest.raw}${shared.unit}.`
    : shared ? pages[0]?.note ?? null : null

  return { kind: 'pages', summary, trailing, pages: presented }
}
