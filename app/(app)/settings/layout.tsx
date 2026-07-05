import { Container } from '@/components/ui/container'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container variant="narrow" className="space-y-8 py-8">
      {children}
    </Container>
  )
}
