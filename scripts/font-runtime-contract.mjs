import postcss from 'postcss'

/** Match real selector lists, including production optimizer combinations. */
export function stylesheetHasSelector(css, selector) {
  let found = false
  postcss.parse(css).walkRules(rule => {
    if (rule.selectors.includes(selector)) found = true
  })
  return found
}

/** Inspect actual Next stylesheet links without depending on build filenames. */
export function fontStylesheetUrls(html, pageUrl) {
  const page = new URL(pageUrl)
  const urls = new Set()
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = Object.fromEntries([...match[0].matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)].map(attr => [attr[1].toLowerCase(), attr[3]]))
    if (!attrs.rel?.toLowerCase().split(/\s+/).includes('stylesheet') || !attrs.href) continue
    const url = new URL(attrs.href.replaceAll('&amp;', '&'), page)
    if (url.origin === page.origin && url.pathname.startsWith('/_next/static/') && url.pathname.endsWith('.css')) urls.add(url.href)
  }
  return [...urls]
}
