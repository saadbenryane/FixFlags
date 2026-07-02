import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { BLOG_POSTS } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('blog', '/blog')

export default function BlogPage() {
  return (
    <Section spacing="marketing" className="scroll-mt-[var(--header-offset)]">
      <Container className="mx-auto max-w-3xl space-y-12">
        <LandingSectionHeader
          label="Blog"
          headline="Notes on shipping without the embarrassing bugs"
          align="left"
        />

        <ol className="space-y-8">
          {BLOG_POSTS.map((post) => (
            <li key={post.slug} className="space-y-3 border-b border-border/30 pb-8 last:border-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <time
                  dateTime={post.date}
                  className="font-mono text-[11px] uppercase tracking-label text-muted-foreground"
                >
                  {post.date}
                </time>
                <h2 className="text-lg font-semibold">
                  <Link href={`/blog/${post.slug}`} className="hover:underline">
                    {post.title}
                  </Link>
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
              <Link
                href={`/blog/${post.slug}`}
                className="inline-block text-sm font-medium text-brand hover:underline"
              >
                Read more &rarr;
              </Link>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  )
}
