import { notFound, redirect } from 'next/navigation'
import { getAppViewer } from '@/lib/auth/app-viewer'

type ProductPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ historyCursor?: string }>
}

/** Legacy Product workspace redirects into the Site board. */
export default async function ProductPage({ params }: ProductPageProps) {
  const viewer = await getAppViewer()
  if (!viewer) redirect('/sign-in')
  const { id } = await params
  if (!id) notFound()
  redirect(`/sites/${id}`)
}
