const MISSING_PAGE = /page not found|not found|doesn't exist|does not exist|404|no longer available|we couldn't find/i

/** Shared missing-page wording for original responses and bounded visible copy. */
export function hasMissingPageContent(headings: readonly string[], text: string): boolean {
  return headings.some(heading => MISSING_PAGE.test(heading)) ||
    headings.length > 0 && MISSING_PAGE.test(text.slice(0, 400))
}
