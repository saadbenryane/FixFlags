export type PublicHttpDocument = {
  body: string; finalUrl: string; statusCode: number; headers: Record<string, string>;
  complete: boolean; redirects: string[];
}

/** A failed body cannot erase an already observed response or become complete
 * content. Consumers needing a whole body retain the ordinary error path. */
export class PublicResponseBodyError extends Error {
  readonly response: Omit<PublicHttpDocument, 'body' | 'complete'> & { body: string | null; complete: false }
  constructor(response: Omit<PublicHttpDocument, 'body' | 'complete'> & { body: string | null }, cause: unknown) {
    super('Public response body could not be collected', { cause })
    this.name = 'PublicResponseBodyError'
    this.response = { ...response, complete: false }
  }
}
