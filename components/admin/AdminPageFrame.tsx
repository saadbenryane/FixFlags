import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
export function AdminPageFrame({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Container variant="wide" className="space-y-8 py-8">
      <PageHeader title={title} description={description} />
      {children}
    </Container>
  )
}
export function AdminSurface({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-card bg-muted/30 p-5 sm:p-6">
      {title && <h2 className="text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  )
}
