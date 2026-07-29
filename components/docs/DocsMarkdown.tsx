import { isValidElement, type ReactNode } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { DocsCodeBlock } from '@/components/docs/DocsCodeBlock'
import { slugifyDocsHeading } from '@/lib/docs/catalog'

function textFromNode(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textFromNode).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textFromNode(node.props.children)
  return ''
}

export function DocsMarkdown({ children }: { children: string }) {
  return (
    <div className="docs-prose text-base leading-8 text-foreground/90 [&_h2]:scroll-mt-32 [&_h2]:font-serif [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:tracking-display [&_h2]:text-foreground [&_h2]:mt-16 [&_h2]:mb-5 [&_h3]:scroll-mt-32 [&_h3]:mt-10 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_p]:my-5 [&_p]:text-pretty [&_ul]:my-5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-2 [&_strong]:font-semibold [&_strong]:text-foreground [&_a]:font-medium [&_a]:text-link [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-link-hover [&_blockquote]:my-6 [&_blockquote]:border-l-2 [&_blockquote]:border-brand [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.875em]">
      <ReactMarkdown
        components={{
          h2: ({ children: heading }) => (
            <h2 id={slugifyDocsHeading(textFromNode(heading))}>{heading}</h2>
          ),
          h3: ({ children: heading }) => (
            <h3 id={slugifyDocsHeading(textFromNode(heading))}>{heading}</h3>
          ),
          a: ({ href = '', children: label }) =>
            href.startsWith('/')
              ? <Link href={href as Route}>{label}</Link>
              : <a href={href}>{label}</a>,
          pre: ({ children: preChildren }) => {
            if (!isValidElement<{ children?: ReactNode; className?: string }>(preChildren)) {
              return <pre>{preChildren}</pre>
            }
            const code = textFromNode(preChildren.props.children).replace(/\n$/, '')
            const label = preChildren.props.className?.replace('language-', '') || 'Code'
            return <DocsCodeBlock code={code} label={label} />
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
