import { redirect } from 'next/navigation'

/** Legacy Shopify purchase-path link. Shopify now connects to a shared Site. */
export default function ProtectPage() {
  redirect('/install')
}
