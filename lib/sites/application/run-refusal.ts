/** A Site run the customer cannot start. The message is safe to show. */
export class SiteRunRefusal extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code = 'SITE_RUN_REFUSED') {
    super(message)
    this.name = 'SiteRunRefusal'
    this.status = status
    this.code = code
  }
}
