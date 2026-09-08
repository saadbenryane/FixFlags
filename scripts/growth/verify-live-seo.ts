#!/usr/bin/env -S npx tsx
/**
 * Production crawl/snippet checks for the pre-publish SEO cut.
 * Reports observations. Exits 1 when expected current-repo titles or crawl
 * hygiene are not live yet.
 */
const ORIGIN = process.env.SEO_VERIFY_ORIGIN?.replace(/\/$/, '') || 'https://fixflags.com'
const WWW = ORIGIN.replace('https://', 'https://www.')

type Check = {
  id: string
  ok: boolean
  detail: string
}

async function fetchResponse(url: string, redirect: RequestRedirect = 'follow'): Promise<Response> {
  return fetch(url, { redirect, headers: { 'user-agent': 'FixFlagsSEOVerify/1.0' } })
}

function titleFromHtml(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return match?.[1]?.trim() ?? ''
}

async function main(): Promise<void> {
  const checks: Check[] = []

  const www = await fetchResponse(`${WWW}/`, 'manual')
  const wwwLocation = www.headers.get('location') ?? ''
  checks.push({
    id: 'www-redirect',
    ok: (www.status === 308 || www.status === 301) && wwwLocation.includes('fixflags.com') && !wwwLocation.includes('www.'),
    detail: `www status ${www.status} location=${wwwLocation || '(none)'}`,
  })

  const home = await fetchResponse(`${ORIGIN}/`)
  const homeHtml = await home.text()
  const homeTitle = titleFromHtml(homeHtml)
  checks.push({
    id: 'home-title',
    ok: home.status === 200 && /FixFlags/i.test(homeTitle) && /looked after/i.test(homeTitle),
    detail: `home status ${home.status} title=${JSON.stringify(homeTitle)}`,
  })
  checks.push({
    id: 'home-retired-tagline',
    ok: !/finish what your ai started/i.test(homeHtml),
    detail: /finish what your ai started/i.test(homeHtml)
      ? 'production HTML still contains the retired tagline'
      : 'retired tagline absent from homepage HTML',
  })

  const pricing = await fetchResponse(`${ORIGIN}/pricing`)
  const pricingTitle = titleFromHtml(await pricing.text())
  checks.push({
    id: 'pricing-title',
    ok: /FixFlags/i.test(pricingTitle),
    detail: `pricing status ${pricing.status} title=${JSON.stringify(pricingTitle)}`,
  })

  const partners = await fetchResponse(`${ORIGIN}/partners`)
  const partnersTitle = titleFromHtml(await partners.text())
  checks.push({
    id: 'partners-title',
    ok: /FixFlags/i.test(partnersTitle),
    detail: `partners status ${partners.status} title=${JSON.stringify(partnersTitle)}`,
  })

  const sitemap = await fetchResponse(`${ORIGIN}/sitemap.xml`)
  const sitemapXml = await sitemap.text()
  const variantCount = [...sitemapXml.matchAll(/::page:/g)].length
  checks.push({
    id: 'sitemap-no-page-variants',
    ok: sitemap.status === 200 && variantCount === 0,
    detail: `sitemap status ${sitemap.status} ::page: count=${variantCount}`,
  })

  const issue = await fetchResponse(`${ORIGIN}/issues/no-structured-data`)
  checks.push({
    id: 'sample-issue',
    ok: issue.status === 200,
    detail: `issue status ${issue.status}`,
  })

  for (const check of checks) {
    console.log(`${check.ok ? 'pass' : 'fail'}  ${check.id}  ${check.detail}`)
  }

  const failed = checks.filter((check) => !check.ok)
  if (failed.length > 0) {
    console.error(`[verify-live-seo] ${failed.length} check(s) not live yet`)
    process.exit(1)
  }
  console.log('[verify-live-seo] production matches the current SEO cut')
}

main().catch((error) => {
  console.error('[verify-live-seo] fatal:', error)
  process.exit(1)
})
