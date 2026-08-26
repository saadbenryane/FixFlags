import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
import { buildBlogPostMetadata } from '@/lib/marketing/metadata'
import { BLOG_POSTS, BRAND } from '@/lib/marketing/copy'
import { blogPostingSchema } from '@/lib/marketing/structured-data'

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
  if (!post) return { title: `Blog: ${BRAND.name}` }

  return buildBlogPostMetadata(post)
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = findPost(slug)
  if (!post) notFound()

  const jsonLd = blogPostingSchema(post)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Section spacing="marketing" className="scroll-mt-[var(--header-offset)]">
        <Container className="mx-auto max-w-2xl space-y-8">
          <main className="space-y-8">
            <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground">
              &larr; Back to blog
            </Link>
            <div className="space-y-3">
              <time
                dateTime={post.date}
                className="font-mono text-2xs uppercase tracking-label text-muted-foreground"
              >
                {post.date}
              </time>
              <Heading as="h1" className="text-3xl">{post.title}</Heading>
            </div>
            <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
              {post.body.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </main>
        </Container>
      </Section>
    </>
  )
}
