import { AUTH } from './auth'
import { BILLING_PAGE_COPY } from './plans'
import { API_KEY_COPY } from './terminology'

/** App navigation labels. Each word is borrowed from the surface that owns
 * it, so a page title and the navigation entry that leads to it never drift
 * apart. */
export const APP_NAV_COPY = {
  billing: BILLING_PAGE_COPY.title,
  apiKeys: API_KEY_COPY.title,
  account: AUTH.settings.pageTitle,
  docs: 'Docs',
  help: 'Help',
  admin: 'Admin',
} as const

/** Footer column headings. */
export const FOOTER_COLUMN_COPY = {
  product: 'Product',
  resources: 'Resources',
  company: 'Company',
  trust: 'Trust',
} as const
