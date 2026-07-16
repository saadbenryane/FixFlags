import { redirect } from 'next/navigation'

// The live-chat inbox now lives inside the unified Feedback & Support hub.
// Keep this route working for old links and admin email notifications.
export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>
}) {
  const { session } = await searchParams
  const params = new URLSearchParams({ tab: 'conversations' })
  if (session) params.set('session', session)
  redirect(`/admin/feedback?${params.toString()}`)
}
