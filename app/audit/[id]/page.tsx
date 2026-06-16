import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AuditPageRedirect({ params }: Props) {
  const { id } = await params
  redirect(`/report/${id}`)
}
