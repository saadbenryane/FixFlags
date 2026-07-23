import { redirect } from 'next/navigation'

/** Convenient start URL. Lands on the homepage audit form. */
export default function NewAuditPage() {
  redirect('/#audit')
}
