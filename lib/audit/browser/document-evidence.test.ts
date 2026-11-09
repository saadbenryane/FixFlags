import { describe, expect, it } from 'vitest'
import { documentEvidenceWithheld, renderedDocumentForSearch, renderedResponseHeadersForSearch } from './document-evidence'
import { searchResourceKey } from '../search/resource-identity'

const snapshot = { sections: { links: { complete: true } } }

describe('document evidence', () => {
  it('reads browser headers only for the captured HTTP resource', () => {
    const desktopFinalUrl = 'https://example.com/catalog?plan=pro#details'
    const responseHeaders = { 'x-robots-tag': 'noindex' }
    const recorded = { desktopFinalUrl, responseHeaders, desktopResponseResourceKey: searchResourceKey(desktopFinalUrl) }
    expect(renderedResponseHeadersForSearch(recorded)).toBe(responseHeaders)
    expect(renderedResponseHeadersForSearch({ ...recorded, desktopFinalUrl: desktopFinalUrl.replace('pro', 'free') })).toBeUndefined()
    expect(renderedResponseHeadersForSearch({ ...recorded, desktopResponseResourceKey: undefined })).toBeUndefined()
    expect(renderedResponseHeadersForSearch({ ...recorded, collectionRestrictions: ['read_only_refusal'] })).toBeUndefined()
  })
  it('keeps a captured page when the only restriction is a refused action', () => {
    expect(documentEvidenceWithheld(['protected_action_requires_fixture', 'payment_or_download_blocked'])).toBe(false)
    expect(renderedDocumentForSearch({
      desktopHtml: '<html></html>', desktopHtmlTruncated: false,
      collectionRestrictions: ['protected_action_requires_fixture'], renderedSearchSnapshot: snapshot,
    })).toEqual({ renderedHtml: '<html></html>', renderedSearchSnapshot: snapshot, renderedComplete: true })
  })

  it('withholds the document when a request it depended on was not collected or the body was truncated', () => {
    expect(documentEvidenceWithheld(['protected_action_requires_fixture', 'read_only_refusal'])).toBe(true)
    expect(renderedDocumentForSearch({
      desktopHtml: '<html></html>', collectionRestrictions: ['read_only_refusal'], renderedSearchSnapshot: snapshot,
    })).toEqual({ renderedHtml: '<html></html>', renderedSearchSnapshot: undefined, renderedComplete: false })
    expect(renderedDocumentForSearch({
      desktopHtml: '<html></html>', desktopHtmlTruncated: true, renderedSearchSnapshot: snapshot,
    }).renderedComplete).toBe(false)
  })
  it('retains independently bounded Search sections when whole-document collection exceeds its limit', () => {
    expect(renderedDocumentForSearch({
      desktopHtml: null, desktopHtmlTruncated: true, renderedSearchSnapshot: snapshot,
    })).toEqual({ renderedHtml: null, renderedSearchSnapshot: snapshot, renderedComplete: false })
    expect(renderedDocumentForSearch({
      desktopHtml: null, desktopHtmlTruncated: true, renderedSearchSnapshot: snapshot,
      collectionRestrictions: ['read_only_refusal'],
    })).toEqual({ renderedHtml: null, renderedSearchSnapshot: undefined, renderedComplete: false })
  })
})
