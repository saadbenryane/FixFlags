import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body } from '@/components/ui/typography'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { HelpArticleList } from '@/components/help/HelpArticleList'
import { HelpChatEscalate } from '@/components/help/HelpChatEscalate'
import { HELP_CATEGORIES } from '@/lib/help/catalog'
import { getArticlesForCategory, getHelpCategory } from '@/lib/help/search'
import { HELP_CENTER, BRAND, SITE_URL } from '@/lib/marketing/copy'
import { DEFAULT_OG_IMAGE } from '@/lib/marketing/metadata'
import type { HelpCategoryId } from '@/lib/help/types'

interface Props {
  params: Promise<{ category: string }>
}

export function generateStaticParams() {
  return HELP_CATEGORIES.map((c) => ({ category: c.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: categoryId } = await params
  const category = getHelpCategory(categoryId as HelpCategoryId)
  if (!category) return { title: HELP_CENTER.label }

  const url = `${SITE_URL}/help/${category.id}`
  return {
    title: `${category.title}: ${BRAND.name} Help`,
    description: category.description,
    alternates: { canonical: url },
    openGraph: {
      title: category.title,
      description: category.description,
      url,
      siteName: BRAND.name,
      images: [DEFAULT_OG_IMAGE],
    },
  }
}

export default async function HelpCategoryPage({ params }: Props) {
  const { category: categoryId } = await params
  const category = getHelpCategory(categoryId as HelpCategoryId)
  if (!category) notFound()

  const articles = getArticlesForCategory(category.id)

  return (
    <Section spacing="marketing">
      <Container>
        <div className="mx-auto max-w-3xl space-y-8">
          <div>
            <Link
              href="/help"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              ← {HELP_CENTER.backToHelp}
            </Link>
            <div className="mt-4 text-center sm:text-left">
              <LandingSectionHeader
                label={HELP_CENTER.label}
                headline={category.title}
                as="h1"
              />
              <Body className="mt-3 text-muted-foreground">{category.description}</Body>
            </div>
          </div>

          <HelpArticleList articles={articles} showHeading={false} />
          <HelpChatEscalate className="rounded-card glass-surface shadow-card p-5" />
        </div>
      </Container>
    </Section>
  )
}
