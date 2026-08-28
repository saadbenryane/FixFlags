import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

/**
 * Compare is retired from the customer report loop. Outcome cards under Review
 * history and Product score history cover what changed. Old bookmarks land on
 * the report for this id.
 */
export default async function ComparePage({ params }: Props) {
  const { id } = await params
  redirect(`/report/${id}`)
}
