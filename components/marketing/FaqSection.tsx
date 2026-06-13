import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Heading } from '@/components/ui/typography'

interface FaqItem {
  question: string
  answer: string
}

interface Props {
  items: readonly FaqItem[]
  title?: string
}

export function FaqSection({ items, title = 'Frequently asked questions' }: Props) {
  return (
    <section className="space-y-8">
      {title && (
        <div className="space-y-3 text-center">
          <p className="section-label">FAQ</p>
          <Heading as="h2">{title}</Heading>
        </div>
      )}
      <Accordion type="single" collapsible className="w-full">
        {items.map((item, i) => (
          <AccordionItem key={item.question} value={`item-${i}`}>
            <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
