import { isValidElement, type ReactNode } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { DocsCodeBlock } from '@/components/docs/DocsCodeBlock'
import { slugifyDocsHeading, type DocsHeadingDefinition } from '@/lib/docs/catalog'
import s from './DocsExperience.module.css'

function textFromNode(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textFromNode).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textFromNode(node.props.children)
  return ''
}

export function DocsMarkdown({ children, headings = [] }: { children: string; headings?: readonly DocsHeadingDefinition[] }) {
  return (
    <div className={`docs-prose ${s.prose}`}>
      <ReactMarkdown
        components={{
          hr: () => <div aria-hidden="true" className="h-8" />,
          h2: ({ children: heading }) => {
            const id = slugifyDocsHeading(textFromNode(heading))
            return <h2 id={id}>{headings.find(item => item.id === id)?.aliases?.map(alias =>
              <span key={alias} id={alias} className={s.headingAnchor} aria-hidden="true" />)}{heading}</h2>
          },
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
