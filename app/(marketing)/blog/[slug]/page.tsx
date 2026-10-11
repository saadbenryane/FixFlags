import type { Metadata, Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Button } from '@/components/ui/button'
import { buildBlogPostMetadata } from '@/lib/marketing/metadata'
import { BLOG_POSTS, BLOG_PAGE, blogDate, blogReadingMinutes } from '@/lib/marketing/copy/blog'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { BRAND } from '@/lib/marketing/copy/brand'
import { blogPostingSchema } from '@/lib/marketing/structured-data'
import { getDocsPage } from '@/lib/docs/catalog'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { ArticleReadingProgress } from '@/components/marketing/blog/ArticleReadingProgress'
import s from '@/components/marketing/blog/BlogEditorial.module.css'

interface Props {
  params: Promise<{ slug: string }>
}

function findPost(slug: string) {
  return BLOG_POSTS.find(post => post.slug === slug)
}

export function generateStaticParams() {
  return BLOG_POSTS.map(post => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = findPost(slug)
  return post ? buildBlogPostMetadata(post) : { title: `Blog: ${BRAND.name}` }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = findPost(slug)
  if (!post) notFound()
  const position = BLOG_POSTS.indexOf(post)
  const nextPost = BLOG_POSTS[position + 1]

  return <div className={s.page}>
    <MarketingPageViewTracker page={`/blog/${post.slug}`} />
    <ArticleReadingProgress key={post.slug} articleId="blog-article-content" />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingSchema(post)) }} />
    <Container variant="marketing" className={s.container}>
      <Link href="/blog" className={s.back}><ArrowLeft size={16} aria-hidden="true" />{BLOG_PAGE.back}</Link>
      <header className={s.header}>
        <div className={s.kicker}>
          <span className={s.number}>{String(position + 1).padStart(2, '0')}</span>
          <span>{BLOG_PAGE.seriesLabel}</span>
          <span>{post.category}</span>
        </div>
        <h1 className={s.title}>{post.title}</h1>
        <p className={s.deck}>{post.excerpt}</p>
        <div className={s.meta}>
          <span className={s.author}>{BRAND.name}</span>
          <time dateTime={post.date}>{blogDate(post.date)}</time>
          <span>{BLOG_PAGE.readingTime(blogReadingMinutes(post))}</span>
          {post.updatedAt ? <span>{BLOG_PAGE.updatedLabel} <time dateTime={post.updatedAt}>{blogDate(post.updatedAt)}</time></span> : null}
        </div>
        {post.dateNote ? <p className={s.dateNote}>{post.dateNote}</p> : null}
      </header>
      <figure className={s.cover}>
        <Image src={post.cover.src} alt={post.cover.alt} width={post.cover.width} height={post.cover.height} priority sizes="(min-width: 1280px) 1120px, calc(100vw - 40px)" />
      </figure>
      <div className={s.readingLayout}>
        <aside className={s.contents}>
          <nav aria-label={BLOG_PAGE.onThisPage}>
            <p>{BLOG_PAGE.onThisPage}</p>
            <ol>{post.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
          </nav>
        </aside>
        <article id="blog-article-content" aria-label={post.title} className={s.article}>
          <div className={s.intro}>{post.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
          {post.sections.map(section => <section key={section.id} id={section.id} className={s.articleSection}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </section>)}
          <p className="mt-8"><Link href="/coverage" className="text-link underline underline-offset-4">{PUBLIC_SITE_COPY.coverage}</Link></p>
        </article>
        <div className={s.ending}>
          <section className={s.related} aria-labelledby="blog-related-guides">
            <h2 id="blog-related-guides">{BLOG_PAGE.relatedTitle}</h2>
            <ul>{post.relatedDocs.map(key => {
              const page = getDocsPage(key)
              return <li key={key}><Link href={page.path as Route}>{page.title} &rarr;</Link></li>
            })}</ul>
            <Button asChild variant="brand"><Link href="/new">{BLOG_PAGE.startCta}<ArrowRight size={16} aria-hidden="true" /></Link></Button>
          </section>
          {nextPost ? <Link href={`/blog/${nextPost.slug}`} className={s.next}>
            <div><span>{BLOG_PAGE.nextArticle}</span><strong>{nextPost.title}</strong></div>
            <ArrowRight size={20} aria-hidden="true" />
          </Link> : null}
        </div>
      </div>
    </Container>
  </div>
}
