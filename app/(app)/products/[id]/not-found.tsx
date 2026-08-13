import Link from 'next/link'
import { PackageX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'

export default function ProductNotFound() {
  return (
    <Container variant="narrow" className="px-4 py-16 sm:px-6">
      <EmptyState
        icon={<PackageX className="h-7 w-7" aria-hidden />}
        title="Product unavailable"
        description="This Product was deleted, or it belongs to another account."
        action={
          <Button asChild>
            <Link href="/dashboard">Return to Products</Link>
          </Button>
        }
      />
    </Container>
  )
}
