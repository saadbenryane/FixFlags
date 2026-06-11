import { Header } from '@/components/layout/header'

interface Props {
  right?: React.ReactNode
}

/** @deprecated Use Header from @/components/layout/header via marketing layout */
export function MarketingNav({ right }: Props) {
  return <Header right={right} />
}
