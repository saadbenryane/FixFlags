import type { Route } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import type { HelpBlock } from '@/lib/help/types'
import { Callout } from '@/components/ui/callout'
import { Body } from '@/components/ui/typography'

function renderList(items: readonly string[], ordered: boolean, key: number) {
  const Tag = ordered ? 'ol' : 'ul'
  const listClass = ordered ? 'list-decimal' : 'list-disc'
  return (
    <Tag key={key} className={`${listClass} space-y-2 pl-5 text-sm text-muted-foreground`}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </Tag>
  )
}

export function HelpArticleBody({ blocks }: { blocks: readonly HelpBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        if (block.type === 'p') {
          return (
            <Body key={i} className="text-muted-foreground text-pretty">
              {block.text}
            </Body>
          )
        }
        if (block.type === 'h2') {
          return (
            <h2 key={i} className="font-display text-xl tracking-heading text-foreground">
              {block.text}
            </h2>
          )
        }
        if (block.type === 'ul' || block.type === 'ol' || block.type === 'steps') {
          return renderList(block.items, block.type !== 'ul', i)
        }
        if (block.type === 'link') {
          return (
            <p key={i} className="text-sm">
              <Link href={block.href as Route} className="font-medium text-brand hover:underline">
                {block.text}
              </Link>
            </p>
          )
        }
        if (block.type === 'code') {
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-card bg-muted/50 p-4 font-mono text-xs text-foreground"
            >
              {block.text}
            </pre>
          )
        }
        if (block.type === 'image') {
          return (
            <figure key={i} className="overflow-hidden rounded-card border border-border/60">
              <Image
                src={block.src}
                alt={block.alt}
                width={1200}
                height={720}
                className="h-auto w-full"
              />
            </figure>
          )
        }
        return (
          <Callout key={i} variant="info">
            <p>{block.text}</p>
          </Callout>
        )
      })}
    </div>
  )
}
