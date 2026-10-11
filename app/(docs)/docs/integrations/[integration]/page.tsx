import { notFound } from 'next/navigation'
import { DocsMarkdown } from '@/components/docs/DocsMarkdown'
import { DocsPageFrame } from '@/components/docs/DocsPageFrame'
import { ShopifyConnectionRecovery } from '@/components/docs/ShopifyConnectionRecovery'
import { buildDocsMetadata, DOCS_PAGES, getDocsPageByPath } from '@/lib/docs/catalog'
import { readDocsMarkdown } from '@/lib/docs/content'

type Props = {
  params: Promise<{ integration: string }>
  searchParams: Promise<{ error?: string | string[] }>
}

export function generateStaticParams() {
  return DOCS_PAGES.filter(page => page.parentKey === 'integrations').map(page => ({ integration: page.key }))
}

export async function generateMetadata({ params }: Props) {
  const { integration } = await params
  const page = getDocsPageByPath(`/docs/integrations/${integration}`)
  return page ? buildDocsMetadata(page) : {}
}

export default async function IntegrationGuide({ params, searchParams }: Props) {
  const { integration } = await params
  const page = getDocsPageByPath(`/docs/integrations/${integration}`)
  if (!page || page.parentKey !== 'integrations') notFound()
  const { error } = await searchParams
  return <DocsPageFrame page={page}>
    {page.key === 'shopify' ? <ShopifyConnectionRecovery error={typeof error === 'string' ? error : undefined} /> : null}
    <DocsMarkdown>{await readDocsMarkdown(page)}</DocsMarkdown>
  </DocsPageFrame>
}
