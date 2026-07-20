import type { HelpBlock } from '@/lib/help/types'
import { Callout } from '@/components/ui/callout'
import { Body } from '@/components/ui/typography'

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
        if (block.type === 'ul') {
          return (
            <ul key={i} className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )
        }
        if (block.type === 'ol') {
          return (
            <ol key={i} className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
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
