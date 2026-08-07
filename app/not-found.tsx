import { SiteShell } from '@/components/layout/site-shell'
import { NotFoundContent } from '@/components/report/NotFoundContent'

export default function NotFound() {
  return (
    <SiteShell variant="marketing">
      <NotFoundContent />
    </SiteShell>
  )
}
