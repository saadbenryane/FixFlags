import { redirect } from 'next/navigation'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('protect', '/protect')

/** Legacy Shopify purchase-path link. Shopify now connects to a shared Site. */
export default function ProtectPage() {
  redirect('/install')
}
