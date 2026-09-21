import { CliAuthorizeCard } from '@/components/cli/CliAuthorizeCard'

export default async function CliAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<{ user_code?: string }>
}) {
  const { user_code: userCode } = await searchParams
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center px-5 py-10">
      <CliAuthorizeCard userCode={userCode ?? ''} />
    </div>
  )
}
