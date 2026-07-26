import type { Metadata } from 'next'
import { CliAuthorizeCard } from '@/components/cli/CliAuthorizeCard'

export const metadata: Metadata = {
  title: 'Authorize FixFlags CLI',
}

export default async function CliAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<{ user_code?: string }>
}) {
  const { user_code: userCode = '' } = await searchParams
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 py-12">
      <CliAuthorizeCard userCode={userCode} />
    </main>
  )
}
