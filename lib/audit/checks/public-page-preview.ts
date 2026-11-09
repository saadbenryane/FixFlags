import { load } from 'cheerio'
import { z } from 'zod'
import { captureObservationScopeSchema } from '../browser/observation-scope'
import { PUBLIC_SIGN_IN_REDIRECT } from '../browser/page-capture'
import { isPublicChallengeHeader, isSuccessfulPublicGetStatus } from '../http-evidence'
import type { PublicDocument } from '../search/contracts'
import { NATIVE_HEAD_TEXT_LIMIT } from './head-metadata'

const PUBLIC_HEAD_LIMIT = 64 * 1024
const previewValue = z.string().max(NATIVE_HEAD_TEXT_LIMIT).nullable().optional()
export const publicPagePreviewSchema = z.object({
  scope: captureObservationScopeSchema, ogTitle: previewValue, ogDescription: previewValue, ogImage: previewValue,
  linkBaseUrl: z.string().url().optional(),
}).strict()
export type PublicPagePreview = z.infer<typeof publicPagePreviewSchema>

type LocatedNode = { sourceCodeLocation?: { startTag?: unknown; endTag?: unknown } | null }

/** Use the public response prefix. A parser-observed head boundary can be
 * complete even when the rest of the page exceeded the response budget. */
export function readPublicPagePreview(document: PublicDocument): PublicPagePreview | undefined {
  const { status, body, headers, reason } = document
  const type = headers['content-type']?.split(';')[0].trim().toLowerCase()
  if (status === null || !isSuccessfulPublicGetStatus(status) || !body ||
    reason === PUBLIC_SIGN_IN_REDIRECT || reason === 'public_access_challenge' || isPublicChallengeHeader(headers['cf-mitigated']) ||
    type !== 'text/html' && type !== 'application/xhtml+xml') return undefined

  const $ = load(body.slice(0, PUBLIC_HEAD_LIMIT), { sourceCodeLocationInfo: true })
  const head = $('head').get(0) as LocatedNode | undefined
  const content = $('body').get(0) as LocatedNode | undefined
  if (!(document.complete && body.length <= PUBLIC_HEAD_LIMIT) && !head?.sourceCodeLocation?.endTag && !content?.sourceCodeLocation?.startTag)
    return undefined

  const field = (property: string) => {
    // Open Graph gives the first declared value precedence.
    const value = $(`head > meta:is(${property})`).first().attr('content')?.trim() || null
    return value && value.length > NATIVE_HEAD_TEXT_LIMIT ? undefined : value
  }
  const publicUrl = (url: string) => { const parsed = new URL(url); parsed.hash = ''; return parsed.href }
  const finalUrl = publicUrl(document.finalUrl)
  const rawBase = $('head > base[href]').first().attr('href')
  let linkBaseUrl = finalUrl
  try { if (rawBase) linkBaseUrl = new URL(rawBase, finalUrl).href } catch { /* An invalid base leaves the response URL in effect. */ }
  return { scope: { pageUrl: publicUrl(document.url), finalUrl, profile: 'public-html-head-v1', access: 'public' },
    ogTitle: field('[property="og:title" i]'), ogDescription: field('[property="og:description" i]'),
    ogImage: field('[property="og:image" i], [property="og:image:url" i]'), linkBaseUrl }
}
