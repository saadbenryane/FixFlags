import { SITE_ERRORS } from '@/lib/marketing/copy/errors'

/** The Site does not exist for the requesting owner. Every ownership check
 * raises this one shape, so a route, a tool, or a service reports the same
 * answer instead of a server fault. */
export class SiteNotFound extends Error {
  readonly status = 404
  readonly code = 'SITE_NOT_FOUND'

  constructor(message = SITE_ERRORS.notFound) {
    super(message)
    this.name = 'SiteNotFound'
  }
}
