import { buildPublicSitemap } from './entries'

export const dynamic = 'force-dynamic'

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

export async function GET() {
  const entries = await buildPublicSitemap()
  const urls = entries.map(({ url, lastModified, changeFrequency, priority }) => {
    const date = lastModified instanceof Date ? lastModified.toISOString() : lastModified
    return [
      '<url>', `<loc>${escapeXml(url)}</loc>`,
      ...(date ? [`<lastmod>${escapeXml(date)}</lastmod>`] : []),
      ...(changeFrequency ? [`<changefreq>${changeFrequency}</changefreq>`] : []),
      ...(priority !== undefined ? [`<priority>${priority}</priority>`] : []),
      '</url>',
    ].join('\n')
  })
  const xml = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...urls, '</urlset>', ''].join('\n')
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
