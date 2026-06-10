import { prisma } from '@/lib/db'
import { UserTable } from '@/components/admin/UserTable'

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      auditsUsed: true,
      auditsLimit: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Users ({users.length})</h1>
      <UserTable users={users} />
    </div>
  )
}
