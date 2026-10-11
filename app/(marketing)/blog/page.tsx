import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { BLOG_POSTS, BLOG_PAGE, blogDate, blogReadingMinutes } from '@/lib/marketing/copy/blog'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import s from '@/components/marketing/blog/BlogEditorial.module.css'

export const metadata = buildPageMetadata('blog', '/blog')

export default function BlogPage() {
  return <div className={s.page}>
    <MarketingPageViewTracker page="/blog" />
    <Container variant="marketing" className={s.container}>
      <header>
        <p className={s.kicker}>{BLOG_PAGE.label}</p>
        <h1 className={s.indexTitle}>{BLOG_PAGE.headline}</h1>
        <p className={s.deck}>{BLOG_PAGE.body}</p>
      </header>
      <ol className={s.posts}>
        {BLOG_POSTS.map((post, position) => <li key={post.slug}>
          <article className={position === 0 ? s.featured : s.post}>
            <div className={position === 0 ? s.featuredCopy : undefined}>
              <div className={s.kicker}><span className={s.number}>{String(position + 1).padStart(2, '0')}</span><span>{post.category}</span></div>
              <h2 className={s.postTitle}><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
              <p className={s.excerpt}>{post.excerpt}</p>
              <div className={s.meta}><time dateTime={post.date}>{blogDate(post.date)}</time><span>{BLOG_PAGE.readingTime(blogReadingMinutes(post))}</span></div>
              <Link href={`/blog/${post.slug}`} className={s.readLink} aria-label={`${BLOG_PAGE.readArticle}: ${post.title}`}>{BLOG_PAGE.readArticle}<ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
            {position === 0 ? <div className={s.featuredImage}><Image src={post.cover.src} alt={post.cover.alt} fill priority sizes="(min-width: 1280px) 540px, (min-width: 768px) 50vw, calc(100vw - 40px)" /></div> : null}
          </article>
        </li>)}
      </ol>
      <section className={s.indexEnding} aria-labelledby="blog-next-step">
        <div><h2 id="blog-next-step">{BLOG_PAGE.guideTitle}</h2><p>{BLOG_PAGE.guideBody}</p></div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
          <Link href="/new" className={s.readLink}>{BLOG_PAGE.startCta}<ArrowRight size={16} aria-hidden="true" /></Link>
          <Link href="/docs" className={s.readLink}>{BLOG_PAGE.docsCta}</Link>
        </div>
      </section>
    </Container>
  </div>
}
