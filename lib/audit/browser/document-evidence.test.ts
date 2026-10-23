import { describe, expect, it } from 'vitest'
import { documentEvidenceWithheld, renderedDocumentForSearch } from './document-evidence'

const snapshot = { sections: { links: { complete: true } } }

describe('document evidence', () => {
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
})
