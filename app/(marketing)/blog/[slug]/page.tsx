import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { BLOG_POSTS, BRAND, SITE_URL } from '@/lib/marketing/copy'
import { DEFAULT_OG_IMAGE } from '@/lib/marketing/metadata'

interface Props {
  params: Promise<{ slug: string }>
}

function findPost(slug: string) {
  return BLOG_POSTS.find((post) => post.slug === slug)
}

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = findPost(slug)
  if (!post) return { title: `Blog — ${BRAND.name}` }

  const url = `${SITE_URL}/blog/${post.slug}`

  return {
    title: `${post.title} — ${BRAND.name} Blog`,
    description: post.excerpt,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      url,
      siteName: BRAND.name,
      publishedTime: post.date,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [DEFAULT_OG_IMAGE.url],
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = findPost(slug)
  if (!post) notFound()

  return (
    <Section spacing="marketing" className="scroll-mt-[var(--header-offset)]">
      <Container className="mx-auto max-w-2xl space-y-8">
        <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to blog
        </Link>
        <div className="space-y-3">
          <time
            dateTime={post.date}
            className="font-mono text-[11px] uppercase tracking-label text-muted-foreground"
          >
            {post.date}
          </time>
          <h1 className="text-3xl font-semibold text-balance">{post.title}</h1>
        </div>
        <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
          {post.body.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </Container>
    </Section>
  )
}
