#!/usr/bin/env -S npx tsx
import { INDEXABLE_ROUTES } from '@/lib/marketing/seo-routes'
import { BLOG_POSTS } from '@/lib/marketing/copy/blog'
import { WEBSITE_GUIDES } from '@/lib/marketing/copy/guides'
import { indexNowPayload, notifyIndexNow } from '@/lib/growth/indexnow'

async function main() {
  const args = process.argv.slice(2)
  if (args.some(arg => !arg.startsWith('--paths=') && arg !== '--submit')) throw new Error('Invalid options')
  const paths = args.find(arg => arg.startsWith('--paths='))?.slice('--paths='.length).split(',') ?? []
  const allowedPaths = [...INDEXABLE_ROUTES.filter(route => route.path !== '/issues').map(route => route.path),
    ...BLOG_POSTS.map(post => `/blog/${post.slug}`), ...WEBSITE_GUIDES.map(guide => `/guides/${guide.slug}`)]
  const payload = indexNowPayload(paths, allowedPaths, process.env.INDEXNOW_KEY ?? '')
  if (!args.includes('--submit')) {
    console.log(JSON.stringify({ status: 'prepared-not-sent', urlCount: payload.urlList.length, paths,
      keyConfigured: true, keyLocation: payload.keyLocation, indexingVerified: false }, null, 2))
    return
  }
  const report = await notifyIndexNow({ paths, allowedPaths, key: process.env.INDEXNOW_KEY! })
  console.log(JSON.stringify(report, null, 2))
  if (!['notification-accepted', 'key-validation-pending'].includes(report.status)) process.exitCode = 1
}

main().catch(() => {
  console.error('IndexNow notification unavailable. Configure INDEXNOW_KEY and select registered public --paths. No key, provider body or credential was printed.')
  process.exitCode = 1
})
