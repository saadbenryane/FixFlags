/** Refusals of a mutation, payment, download, or auxiliary document. The public
 * page that was already captured stays usable. */
const ACTION_REFUSALS = new Set([
  'protected_action_requires_fixture',
  'payment_or_download_blocked',
  'auxiliary_document_unavailable',
])

/** True when a restriction means the captured document itself cannot be trusted.
 * A refused side action does not. */
export function documentEvidenceWithheld(restrictions: readonly string[] | null | undefined): boolean {
  return Boolean(restrictions?.some(reason => !ACTION_REFUSALS.has(reason)))
}

/** Whole-document limits do not discard independently bounded Search sections.
 * A request the document depended on being refused still withholds both. */
export function renderedDocumentForSearch<T>(snapshot: {
  desktopHtml?: string | null
  desktopHtmlTruncated?: boolean
  collectionRestrictions?: readonly string[] | null
  renderedSearchSnapshot?: T
} | null | undefined): { renderedHtml: string | null; renderedSearchSnapshot: T | undefined; renderedComplete: boolean } {
  const withheld = documentEvidenceWithheld(snapshot?.collectionRestrictions)
  const renderedHtml = snapshot?.desktopHtml ?? null
  return {
    renderedHtml,
    renderedSearchSnapshot: withheld ? undefined : snapshot?.renderedSearchSnapshot,
    renderedComplete: Boolean(renderedHtml) && snapshot?.desktopHtmlTruncated !== true && !withheld,
  }
}
